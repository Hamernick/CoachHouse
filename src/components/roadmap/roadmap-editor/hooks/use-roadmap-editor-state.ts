"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"

import { saveRoadmapSectionAction } from "@/actions/roadmap"
import { useWorkspaceParticles } from "@/features/workspace-particles/client"
import {
  uploadOrgMedia,
  validateOrgMediaFile,
} from "@/lib/organization/org-media"
import { type RoadmapSection, type RoadmapSectionStatus } from "@/lib/roadmap"
import { roadmapBudgetRowsEqual } from "@/lib/roadmap/budget"
import {
  WORKSPACE_ROADMAP_PATH,
  getWorkspaceRoadmapSectionPath,
} from "@/lib/workspace/routes"

import { resolveRoadmapBasePath } from "../paths"
import { deriveRoadmapEditorSectionUi } from "../ui-state"
import {
  createDraft,
  createDraftMap,
  getRoadmapSectionBaseline,
  isRoadmapDraftDirty,
  loadRoadmapDraftsFromStorage,
  roadmapDraftStorageKey,
} from "../helpers"
import { type RoadmapDraft } from "../types"
import { reconcileRoadmapEditorSections } from "../save-state"
import { useRoadmapEditorSave } from "./use-roadmap-editor-save"
import { useRoadmapEditorAutosave } from "./use-roadmap-editor-autosave"
import { useRoadmapEditorDraftPersistence } from "./use-roadmap-editor-draft-persistence"
import type {
  UseRoadmapEditorStateArgs,
  UseRoadmapEditorStateResult,
} from "./use-roadmap-editor-state-types"

export function useRoadmapEditorState({
  sections: initialSections,
  draftScope,
  canEdit = true,
  navigationMode = "route",
  initialSectionId = null,
  onDirtyChange,
  onRegisterDiscard,
  saveSection = saveRoadmapSectionAction,
}: UseRoadmapEditorStateArgs): UseRoadmapEditorStateResult {
  const storageKey = roadmapDraftStorageKey(draftScope)
  const initialActiveId = useMemo(() => {
    if (!initialSectionId) return ""
    return initialSections.some((section) => section.id === initialSectionId)
      ? initialSectionId
      : ""
  }, [initialSections, initialSectionId])
  const [sections, setSections] = useState<RoadmapSection[]>(
    () => initialSections
  )
  const onRoadmapSectionSaved = useWorkspaceParticles()?.updateRoadmapSection
  const [drafts, setDrafts] = useState<Record<string, RoadmapDraft>>(() =>
    createDraftMap(initialSections)
  )
  const [activeId, setActiveId] = useState(
    initialActiveId || initialSections[0]?.id || ""
  )
  const [isHydrated, setIsHydrated] = useState(false)
  const loadedStorageKeyRef = useRef<string | null>(null)
  const sectionsRef = useRef(sections)
  const draftsRef = useRef(drafts)
  const activeIdRef = useRef(activeId)
  const pathname = usePathname()
  const basePath = useMemo(() => resolveRoadmapBasePath(pathname), [pathname])
  const getSectionHref = useCallback(
    (slug: string) =>
      basePath === WORKSPACE_ROADMAP_PATH
        ? getWorkspaceRoadmapSectionPath(slug)
        : `${basePath}/${slug}`,
    [basePath]
  )

  useEffect(() => {
    sectionsRef.current = sections
    for (const section of sections) onRoadmapSectionSaved?.(section)
  }, [onRoadmapSectionSaved, sections])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    const next =
      loadedStorageKeyRef.current === storageKey
        ? reconcileRoadmapEditorSections(
            initialSections,
            sectionsRef.current,
            draftsRef.current
          )
        : {
            sections: initialSections,
            drafts: loadRoadmapDraftsFromStorage(
              canEdit ? storageKey : null,
              initialSections
            ),
          }
    loadedStorageKeyRef.current = storageKey
    sectionsRef.current = next.sections
    draftsRef.current = next.drafts
    setSections(next.sections)
    setDrafts(next.drafts)
    setActiveId((prev) => prev || initialSections[0]?.id || "")
  }, [canEdit, initialSections, storageKey])

  const initialActiveIdRef = useRef(initialActiveId)

  useEffect(() => {
    if (!initialActiveId) return
    if (initialActiveIdRef.current === initialActiveId) return
    initialActiveIdRef.current = initialActiveId
    setActiveId(initialActiveId)
  }, [initialActiveId])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!activeId && sections.length > 0) {
      setActiveId(sections[0].id)
      return
    }

    const activeExists = sections.some((section) => section.id === activeId)
    if (!activeExists && sections.length > 0) {
      setActiveId(sections[0].id)
    }
  }, [activeId, sections])

  useEffect(() => {
    setDrafts((prev) => {
      let changed = false
      const next = { ...prev }
      sections.forEach((section) => {
        if (!next[section.id]) {
          next[section.id] = createDraft(section)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [sections])

  const {
    activeSection,
    activeDraft,
    headerTitle,
    headerSubtitle,
    showSectionHeader,
    editorPlaceholder,
    status,
    isCalendarSection,
    isBudgetSection,
    contentMaxWidth,
  } = useMemo(
    () => deriveRoadmapEditorSectionUi({ sections, activeId, drafts }),
    [sections, activeId, drafts]
  )
  const headerTextRef = useRef<HTMLDivElement | null>(null)
  const [headerIconSize, setHeaderIconSize] = useState<number | null>(null)

  useEffect(() => {
    const element = headerTextRef.current
    if (!element) return
    const measure = () => {
      const next = Math.round(element.offsetHeight)
      if (!next) return
      setHeaderIconSize((previous) => (previous === next ? previous : next))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measure())
    observer.observe(element)
    return () => observer.disconnect()
  }, [headerTitle, headerSubtitle])

  const updateSavedState = useCallback(
    (
      nextSections: RoadmapSection[],
      nextDrafts: Record<string, RoadmapDraft>
    ) => {
      sectionsRef.current = nextSections
      draftsRef.current = nextDrafts
      setSections(nextSections)
      setDrafts(nextDrafts)
    },
    []
  )
  const { savingId, issues, offline, saveSectionById, resolveConflict } =
    useRoadmapEditorSave({
      canEdit,
      draftScope,
      saveSection,
      sectionsRef,
      draftsRef,
      update: updateSavedState,
    })
  const isPending = savingId !== null
  const saveIssue = issues[activeId]

  const flushActiveSectionDraft = useCallback(() => {
    const sectionId = activeIdRef.current
    if (!sectionId) return
    saveSectionById({ sectionId, showToast: false })
  }, [saveSectionById])

  useEffect(() => {
    if (!initialSectionId || initialSectionId === activeIdRef.current) return
    if (!sectionsRef.current.some((section) => section.id === initialSectionId))
      return
    flushActiveSectionDraft()
    setActiveId(initialSectionId)
  }, [flushActiveSectionDraft, initialSectionId])

  const handleSectionSelect = useCallback(
    (next: { id: string; slug: string }) => {
      if (next.id === activeIdRef.current) return
      flushActiveSectionDraft()
      setActiveId(next.id)
      if (navigationMode === "embedded") return
      if (typeof window === "undefined") return
      const nextHref = getSectionHref(next.slug)
      if (window.location.pathname === nextHref) return
      window.history.replaceState(window.history.state, "", nextHref)
    },
    [flushActiveSectionDraft, getSectionHref, navigationMode]
  )

  const isDirty = useMemo(() => {
    if (!activeSection || !activeDraft) return false
    return isRoadmapDraftDirty(activeSection, activeDraft)
  }, [activeDraft, activeSection])

  const bodyDirty = useMemo(() => {
    if (!activeSection || !activeDraft) return false
    const baseline = getRoadmapSectionBaseline(activeSection)
    return (
      activeDraft.content !== baseline.content ||
      !roadmapBudgetRowsEqual(activeDraft.budgetRows, baseline.budgetRows) ||
      activeDraft.imageUrl !== baseline.imageUrl
    )
  }, [activeDraft, activeSection])

  const replaceDrafts = useCallback((next: Record<string, RoadmapDraft>) => {
    draftsRef.current = next
    setDrafts(next)
  }, [])

  const storageFailed = useRoadmapEditorDraftPersistence({
    enabled:
      canEdit && isHydrated && loadedStorageKeyRef.current === storageKey,
    sections,
    drafts,
    replaceDrafts,
    storageKey,
    onDirtyChange,
    onRegisterDiscard,
  })

  const handleDraftChange = useCallback(
    (updates: Partial<RoadmapDraft>) => {
      if (!canEdit) return
      if (!activeSection) return
      const nextDrafts = {
        ...draftsRef.current,
        [activeSection.id]: {
          ...(draftsRef.current[activeSection.id] ??
            createDraft(activeSection)),
          ...updates,
        },
      }
      draftsRef.current = nextDrafts
      setDrafts(nextDrafts)
    },
    [activeSection, canEdit]
  )

  const handleSave = useCallback(() => {
    if (!canEdit) return
    if (!activeSection) return
    saveSectionById({ sectionId: activeSection.id, showToast: true })
  }, [activeSection, canEdit, saveSectionById])

  useRoadmapEditorAutosave({
    canEdit: canEdit && !offline && !saveIssue,
    activeSection,
    activeDraft,
    isDirty,
    bodyDirty,
    isPending,
    savingId,
    saveSectionById,
    flushActiveSectionDraft,
  })

  const handleImageUpload = useCallback(async (file: File) => {
    const error = validateOrgMediaFile(file)
    if (error) {
      throw new Error(error)
    }
    return uploadOrgMedia({ file, kind: "roadmap-inline" })
  }, [])

  const handleStatusChange = useCallback(
    (nextStatus: RoadmapSectionStatus) => {
      saveSectionById({
        sectionId: activeIdRef.current,
        showToast: false,
        nextStatus,
      })
    },
    [saveSectionById]
  )

  return {
    activeSection,
    activeDraft,
    drafts,
    handleSectionSelect,
    roadmapBasePath: basePath,
    headerTitle,
    headerSubtitle,
    showSectionHeader,
    headerIconSize,
    headerTextRef,
    status,
    statusSelectDisabled: isPending || offline || Boolean(saveIssue),
    saveIssue,
    offline,
    storageFailed,
    resolveConflict,
    isHydrated,
    isCalendarSection,
    isBudgetSection,
    contentMaxWidth,
    editorPlaceholder,
    handleDraftChange,
    handleImageUpload,
    handleSave,
    isDirty,
    savingId,
    handleStatusChange,
  }
}
