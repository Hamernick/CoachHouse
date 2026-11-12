"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"

import { toast } from "@/lib/toast"

import {
  createWorkspaceObjectiveAction,
  createWorkspaceObjectiveGroupAction,
  loadWorkspaceObjectivesAction,
  setWorkspaceObjectiveGroupArchivedAction,
  setWorkspaceObjectiveStatusAction,
} from "../../_lib/workspace-objectives-actions"
import {
  isLegacyOrRuntimeTrackerId,
  toggleLocalCategoryArchiveState,
  toggleLocalTicketStatusState,
  trimToSingleLine,
} from "./workspace-board-formation-tracker-card-helpers"
import {
  buildAcceleratorGroups,
  buildTicketsByCategory,
  splitTrackerCategories,
  summarizeTrackerTicketCounts,
  type AcceleratorGroup,
} from "./workspace-board-formation-tracker-card-derived"
import {
  applyCreateCategoryLocal,
  applyCreateTicketLocal,
} from "./workspace-board-formation-tracker-card-local-mutations"
import { useWorkspaceObjectiveEditorState } from "./workspace-board-formation-tracker-card-editor-state"
import { resolveNextTicketStatus } from "./workspace-board-formation-tracker-card-ui"
import {
  mapObjectiveCollectionToTrackerState,
  mapTrackerStatusToObjectiveStatus,
} from "./workspace-board-objectives-bridge"
import type {
  WorkspaceSeedData,
  WorkspaceTrackerState,
  WorkspaceTrackerTicketPriority,
} from "./workspace-board-types"

export function useWorkspaceBoardFormationTrackerController({
  seed,
  presentationMode,
  tracker,
  onTrackerChange,
}: {
  seed: WorkspaceSeedData
  presentationMode: boolean
  tracker: WorkspaceTrackerState
  onTrackerChange: (next: WorkspaceTrackerState) => void
}) {
  const canManageObjectives = seed.canEdit && !presentationMode
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [draftCategoryTitle, setDraftCategoryTitle] = useState("")
  const [draftTicketTitle, setDraftTicketTitle] = useState("")
  const [draftTicketDescription, setDraftTicketDescription] = useState("")
  const [draftTicketPriority, setDraftTicketPriority] = useState<WorkspaceTrackerTicketPriority>("normal")
  const [draftTicketDueDate, setDraftTicketDueDate] = useState("")
  const [draftTicketAssigneeId, setDraftTicketAssigneeId] = useState("")
  const [draftTicketCategoryId, setDraftTicketCategoryId] = useState("")
  const [ticketQuery, setTicketQuery] = useState("")
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | "open" | "done">("all")
  const [objectivesMode, setObjectivesMode] = useState<"unknown" | "normalized" | "legacy">("unknown")
  const [isSyncingObjectives, startObjectivesSync] = useTransition()
  const didHydrateObjectivesRef = useRef(false)
  const groupRevisionsRef = useRef(new Map<string, string>())

  const acceleratorGroups = useMemo<AcceleratorGroup[]>(
    () => buildAcceleratorGroups(seed),
    [seed],
  )

  const { activeCategories, archivedCategories } = useMemo(
    () => splitTrackerCategories(tracker),
    [tracker],
  )

  useEffect(() => {
    if (draftTicketCategoryId && activeCategories.some((category) => category.id === draftTicketCategoryId)) {
      return
    }
    setDraftTicketCategoryId(activeCategories[0]?.id ?? "")
  }, [activeCategories, draftTicketCategoryId])

  useEffect(() => {
    if (!draftTicketAssigneeId) return
    const exists = seed.members.some((member) => member.userId === draftTicketAssigneeId)
    if (!exists) setDraftTicketAssigneeId("")
  }, [draftTicketAssigneeId, seed.members])

  const ticketsByCategory = useMemo(
    () => buildTicketsByCategory(tracker.tickets),
    [tracker.tickets],
  )

  const { openTicketCount, doneTicketCount } = useMemo(
    () => summarizeTrackerTicketCounts(tracker.tickets),
    [tracker.tickets],
  )

  const commitTracker = useCallback((next: WorkspaceTrackerState) => onTrackerChange(next), [onTrackerChange])

  const refreshObjectives = useCallback(
    (tabOverride: WorkspaceTrackerState["tab"]) => {
      startObjectivesSync(async () => {
        const result = await loadWorkspaceObjectivesAction()
        if (!result.ok) {
          toast.error(result.error)
          return
        }

        groupRevisionsRef.current = new Map(result.data.groups.map((group) => [group.id, group.updatedAt]))
        if (result.data.loadedFrom === "normalized") setObjectivesMode("normalized")
        else setObjectivesMode("legacy")

        commitTracker(
          mapObjectiveCollectionToTrackerState({
            collection: result.data,
            tab: tabOverride,
          }),
        )
      })
    },
    [commitTracker],
  )

  useEffect(() => {
    if (didHydrateObjectivesRef.current) return
    didHydrateObjectivesRef.current = true
    refreshObjectives(tracker.tab)
  }, [refreshObjectives, tracker.tab])

  const setTab = (nextTab: WorkspaceTrackerState["tab"]) => {
    if (tracker.tab === nextTab) return
    commitTracker({ ...tracker, tab: nextTab })
  }

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((previous) => ({ ...previous, [sectionId]: !previous[sectionId] }))
  }

  const toggleAcceleratorGroupArchive = (groupId: string) => {
    const archivedSet = new Set(tracker.archivedAcceleratorGroups)
    if (archivedSet.has(groupId)) archivedSet.delete(groupId)
    else archivedSet.add(groupId)
    commitTracker({
      ...tracker,
      archivedAcceleratorGroups: Array.from(archivedSet),
    })
  }

  const createCategory = () => {
    const nextTitle = trimToSingleLine(draftCategoryTitle)
    if (!nextTitle) return
    const exists = tracker.categories.some(
      (category) => category.title.toLowerCase() === nextTitle.toLowerCase(),
    )
    if (exists) {
      setDraftCategoryTitle("")
      return
    }

    if (!canManageObjectives || objectivesMode !== "normalized") {
      applyCreateCategoryLocal({
        tracker,
        title: nextTitle,
        commitTracker,
        setDraftTicketCategoryId,
        setDraftCategoryTitle,
      })
      return
    }

    startObjectivesSync(async () => {
      const result = await createWorkspaceObjectiveGroupAction({ title: nextTitle })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDraftCategoryTitle("")
      setDraftTicketCategoryId(result.data.id)
      refreshObjectives("objectives")
    })
  }

  const toggleCategoryArchive = (categoryId: string) => {
    const category = tracker.categories.find((entry) => entry.id === categoryId)
    if (!category) return

    if (!canManageObjectives || objectivesMode !== "normalized" || isLegacyOrRuntimeTrackerId(categoryId)) {
      commitTracker(toggleLocalCategoryArchiveState({ tracker, categoryId }))
      return
    }

    const expectedUpdatedAt = groupRevisionsRef.current.get(categoryId)
    if (!expectedUpdatedAt) {
      toast.error("Category changed. Reload and try again.")
      return
    }
    startObjectivesSync(async () => {
      const result = await setWorkspaceObjectiveGroupArchivedAction({
        groupId: categoryId,
        archived: !category.archived,
        expectedUpdatedAt,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      refreshObjectives("objectives")
    })
  }

  const createTicket = () => {
    const nextTitle = trimToSingleLine(draftTicketTitle)
    if (!nextTitle || !draftTicketCategoryId) return
    const nextDescription = draftTicketDescription.trim() || null
    const nextDueAt = draftTicketDueDate ? new Date(`${draftTicketDueDate}T12:00:00.000Z`).toISOString() : null

    const categoryExists = tracker.categories.some(
      (category) => category.id === draftTicketCategoryId && !category.archived,
    )
    if (!categoryExists) return

    if (!canManageObjectives || objectivesMode !== "normalized") {
      applyCreateTicketLocal({
        tracker,
        categoryId: draftTicketCategoryId,
        title: nextTitle,
        description: nextDescription,
        priority: draftTicketPriority,
        dueAt: nextDueAt,
        assigneeUserIds: draftTicketAssigneeId ? [draftTicketAssigneeId] : [],
        commitTracker,
        setDraftTicketTitle,
        setDraftTicketDescription,
        setDraftTicketPriority,
        setDraftTicketDueDate,
        setDraftTicketAssigneeId,
      })
      return
    }

    startObjectivesSync(async () => {
      const result = await createWorkspaceObjectiveAction({
        title: nextTitle,
        description: nextDescription,
        groupId: draftTicketCategoryId === "general" ? null : draftTicketCategoryId,
        priority: draftTicketPriority,
        dueAt: nextDueAt,
        userIds: draftTicketAssigneeId ? [draftTicketAssigneeId] : [],
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDraftTicketTitle("")
      setDraftTicketDescription("")
      setDraftTicketPriority("normal")
      setDraftTicketDueDate("")
      setDraftTicketAssigneeId("")
      refreshObjectives("objectives")
    })
  }

  const toggleTicketStatus = (ticketId: string) => {
    const ticket = tracker.tickets.find((entry) => entry.id === ticketId)
    if (!ticket) return

    if (!canManageObjectives || objectivesMode !== "normalized" || isLegacyOrRuntimeTrackerId(ticketId)) {
      commitTracker(
        toggleLocalTicketStatusState({
          tracker,
          ticketId,
          resolveNextStatus: resolveNextTicketStatus,
        }),
      )
      return
    }

    const nextTrackerStatus = resolveNextTicketStatus(ticket.status)
    startObjectivesSync(async () => {
      const result = await setWorkspaceObjectiveStatusAction({
        objectiveId: ticketId,
        expectedUpdatedAt: ticket.updatedAt,
        status: mapTrackerStatusToObjectiveStatus(nextTrackerStatus),
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      refreshObjectives("objectives")
    })
  }

  const editor = useWorkspaceObjectiveEditorState({
    members: seed.members,
    activeCategories,
    tracker,
    canManageObjectives,
    objectivesMode,
    commitTracker,
    refreshObjectives,
    startObjectivesSync: (action) => {
      startObjectivesSync(async () => {
        await action()
      })
    },
  })

  return {
    canManageObjectives,
    collapsedSections,
    draftCategoryTitle,
    draftTicketTitle,
    draftTicketDescription,
    draftTicketPriority,
    draftTicketDueDate,
    draftTicketAssigneeId,
    draftTicketCategoryId,
    ticketQuery,
    ticketStatusFilter,
    editingTicketId: editor.editingTicketId,
    editTitle: editor.editTitle,
    editDescription: editor.editDescription,
    editPriority: editor.editPriority,
    editDueDate: editor.editDueDate,
    editCategoryId: editor.editCategoryId,
    editAssigneeIds: editor.editAssigneeIds,
    isSyncingObjectives,
    acceleratorGroups,
    activeCategories,
    archivedCategories,
    ticketsByCategory,
    openTicketCount,
    doneTicketCount,
    setDraftCategoryTitle,
    setDraftTicketTitle,
    setDraftTicketDescription,
    setDraftTicketPriority,
    setDraftTicketDueDate,
    setDraftTicketAssigneeId,
    setDraftTicketCategoryId,
    setTicketQuery,
    setTicketStatusFilter,
    setTab,
    setEditTitle: editor.setEditTitle,
    setEditDescription: editor.setEditDescription,
    setEditPriority: editor.setEditPriority,
    setEditDueDate: editor.setEditDueDate,
    setEditCategoryId: editor.setEditCategoryId,
    toggleEditAssignee: editor.toggleEditAssignee,
    toggleSectionCollapsed,
    toggleAcceleratorGroupArchive,
    createCategory,
    toggleCategoryArchive,
    createTicket,
    toggleTicketStatus,
    openTicketEditor: editor.openTicketEditor,
    closeTicketEditor: editor.closeTicketEditor,
    saveTicketEdits: editor.saveTicketEdits,
  }
}
