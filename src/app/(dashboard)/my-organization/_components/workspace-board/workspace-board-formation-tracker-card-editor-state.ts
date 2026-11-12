"use client"

import { useEffect, useState } from "react"

import { toast } from "@/lib/toast"

import {
  setWorkspaceObjectiveDetailsAction,
} from "../../_lib/workspace-objectives-actions"
import {
  isLegacyOrRuntimeTrackerId,
  trimToSingleLine,
  updateLocalTicketState,
} from "./workspace-board-formation-tracker-card-helpers"
import type {
  WorkspaceSeedData,
  WorkspaceTrackerState,
  WorkspaceTrackerTicketPriority,
} from "./workspace-board-types"

function toDateInputValue(value: string | null) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

export function useWorkspaceObjectiveEditorState({
  members,
  activeCategories,
  tracker,
  canManageObjectives,
  objectivesMode,
  commitTracker,
  refreshObjectives,
  startObjectivesSync,
}: {
  members: WorkspaceSeedData["members"]
  activeCategories: WorkspaceTrackerState["categories"]
  tracker: WorkspaceTrackerState
  canManageObjectives: boolean
  objectivesMode: "unknown" | "normalized" | "legacy"
  commitTracker: (next: WorkspaceTrackerState) => void
  refreshObjectives: (tab: WorkspaceTrackerState["tab"]) => void
  startObjectivesSync: (action: () => Promise<void>) => void
}) {
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [editRevision, setEditRevision] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPriority, setEditPriority] =
    useState<WorkspaceTrackerTicketPriority>("normal")
  const [editDueDate, setEditDueDate] = useState("")
  const [editCategoryId, setEditCategoryId] = useState("")
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([])

  const openTicketEditor = (ticketId: string) => {
    const ticket = tracker.tickets.find((entry) => entry.id === ticketId)
    if (!ticket) return
    setEditingTicketId(ticket.id)
    setEditRevision(ticket.updatedAt)
    setEditTitle(ticket.title)
    setEditDescription(ticket.description ?? "")
    setEditPriority(ticket.priority)
    setEditDueDate(toDateInputValue(ticket.dueAt))
    setEditCategoryId(ticket.categoryId)
    setEditAssigneeIds(ticket.assigneeUserIds)
  }

  const closeTicketEditor = () => {
    setEditingTicketId(null)
    setEditRevision("")
    setEditTitle("")
    setEditDescription("")
    setEditPriority("normal")
    setEditDueDate("")
    setEditCategoryId("")
    setEditAssigneeIds([])
  }

  const toggleEditAssignee = (userId: string) => {
    setEditAssigneeIds((previous) =>
      previous.includes(userId)
        ? previous.filter((entry) => entry !== userId)
        : [...previous, userId]
    )
  }

  const saveTicketEdits = () => {
    if (!editingTicketId || !canManageObjectives) return
    const normalizedTitle = trimToSingleLine(editTitle)
    if (!normalizedTitle) return

    const normalizedDescription = editDescription.trim() || null
    const normalizedDueAt = editDueDate
      ? new Date(`${editDueDate}T12:00:00.000Z`).toISOString()
      : null
    const normalizedCategoryId =
      editCategoryId || activeCategories[0]?.id || "general"

    if (
      objectivesMode !== "normalized" ||
      isLegacyOrRuntimeTrackerId(editingTicketId)
    ) {
      commitTracker(
        updateLocalTicketState({
          tracker,
          ticketId: editingTicketId,
          updates: {
            title: normalizedTitle,
            description: normalizedDescription,
            priority: editPriority,
            dueAt: normalizedDueAt,
            categoryId: normalizedCategoryId,
            assigneeUserIds: editAssigneeIds,
          },
        })
      )
      closeTicketEditor()
      return
    }

    startObjectivesSync(async () => {
      const detailsResult = await setWorkspaceObjectiveDetailsAction({
        objectiveId: editingTicketId,
        expectedUpdatedAt: editRevision,
        userIds: editAssigneeIds,
        title: normalizedTitle,
        description: normalizedDescription,
        priority: editPriority,
        dueAt: normalizedDueAt,
        groupId: normalizedCategoryId === "general" ? null : normalizedCategoryId,
      })
      if (!detailsResult.ok) {
        toast.error(detailsResult.error)
        return
      }

      closeTicketEditor()
      refreshObjectives("objectives")
    })
  }

  useEffect(() => {
    if (!editingTicketId) return
    const ticket = tracker.tickets.find((entry) => entry.id === editingTicketId)
    if (!ticket) {
      closeTicketEditor()
      return
    }
    const allowedCategoryIds = new Set(
      activeCategories.map((category) => category.id)
    )
    if (!allowedCategoryIds.has(editCategoryId)) {
      setEditCategoryId(ticket.categoryId)
    }
    const allowedMemberIds = new Set(members.map((member) => member.userId))
    setEditAssigneeIds((previous) => {
      const filtered = previous.filter((userId) => allowedMemberIds.has(userId))
      if (
        filtered.length === previous.length &&
        filtered.every((userId, index) => userId === previous[index])
      ) {
        return previous
      }
      return filtered
    })
  }, [
    activeCategories,
    editCategoryId,
    editingTicketId,
    members,
    tracker.tickets,
  ])

  return {
    editingTicketId,
    editTitle,
    editDescription,
    editPriority,
    editDueDate,
    editCategoryId,
    editAssigneeIds,
    setEditTitle,
    setEditDescription,
    setEditPriority,
    setEditDueDate,
    setEditCategoryId,
    openTicketEditor,
    closeTicketEditor,
    toggleEditAssignee,
    saveTicketEdits,
  }
}
