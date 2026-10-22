"use client"

import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { usePathname } from "next/navigation"

import type { AiDocumentProposal,AiDocumentApplication } from "@/features/workspace-ai/client"
import { useRoadmapSave } from "./use-roadmap-save"
import { applyRoadmapAiProposal } from "../ai-proposal"
import {
  uploadOrgMedia,
  validateOrgMediaFile,
} from "@/lib/organization/org-media"
import { toast } from "@/lib/toast"
import { type RoadmapSection, type RoadmapSectionStatus } from "@/lib/roadmap"
import {
  roadmapBudgetRowsEqual,
} from "@/lib/roadmap/budget"
import {
  WORKSPACE_ROADMAP_PATH,
  getWorkspaceRoadmapSectionPath,
} from "@/lib/workspace/routes"

import { resolveRoadmapBasePath } from "../paths"
import { withEditorReturnTo } from "@/lib/workspace/editor-navigation"
import { deriveRoadmapEditorSectionUi } from "../ui-state"
import {
  createDraft,
  createDraftMap,
  getRoadmapSectionBaseline,
  isRoadmapDraftDirty,
  loadRoadmapDraftsFromStorage,
} from "../helpers"
import { type RoadmapDraft } from "../types"
import { useRoadmapEditorAutosave } from "./use-roadmap-editor-autosave"
import { useRoadmapEditorDraftPersistence } from "./use-roadmap-editor-draft-persistence"
import type {
  UseRoadmapEditorStateArgs,
  UseRoadmapEditorStateResult,
} from "./use-roadmap-editor-state-types"

function useRoadmapWindowStatus(
  sections: RoadmapSection[],
  drafts: Record<string, RoadmapDraft>,
  savingId: string | null
) {
  useWorkspaceEditorStatus({
    label: "Roadmap",
    dirty: sections.some(
      (section) =>
        drafts[section.id] && isRoadmapDraftDirty(section, drafts[section.id])
    ),
    pending: Boolean(savingId),
  })
}

async function uploadRoadmapImage(file: File) {
  const error = validateOrgMediaFile(file)
  if (error) throw new Error(error)
  return uploadOrgMedia({ file, kind: "roadmap-inline" })
}

export function useRoadmapEditorState({
  sourceScope,
  sections: initialSections,
  publicSlug,
  canEdit = true,
  navigationMode = "route",
  initialSectionId = null,
  onDirtyChange,
  onRegisterDiscard,
}: UseRoadmapEditorStateArgs): UseRoadmapEditorStateResult {
  const storageKey = sourceScope
    ? `roadmap-draft:${sourceScope.userId}:${sourceScope.organizationId}`
    : `roadmap-draft:${publicSlug ?? "private"}`
  const initialActiveId = initialSections.some(
    (section) => section.id === initialSectionId
  )
    ? (initialSectionId ?? "")
    : ""
  const [sections, setSections] = useState<RoadmapSection[]>(
    () => initialSections
  )
  const [drafts, setDrafts] = useState<Record<string, RoadmapDraft>>(() =>
    createDraftMap(initialSections)
  )
  const [activeId, setActiveId] = useState(
    initialActiveId || initialSections[0]?.id || ""
  )
  const [aiApplication,setAiApplication] = useState<AiDocumentApplication | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  useRoadmapWindowStatus(sections, drafts, savingId)
  const [isHydrated, setIsHydrated] = useState(false)
  const [loadedStorageKey,setLoadedStorageKey]=useState<string | null>(null)
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
    draftsRef.current = drafts
    activeIdRef.current = activeId
  }, [sections, drafts, activeId])

  useEffect(() => {
    setSections(initialSections)
    setDrafts(() => loadRoadmapDraftsFromStorage(storageKey, initialSections))
    setLoadedStorageKey(storageKey)
    setActiveId((prev) => prev || initialSections[0]?.id || "")
  }, [initialSections, storageKey])

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

  const {saveSectionById,conflicts,resolveConflict} = useRoadmapSave({sourceScope,canEdit,isPending,savingId,sectionsRef,draftsRef,
    setSections,setDrafts,setSavingId,setAiApplication,startTransition})

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
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo"
      )
      const nextHref = returnTo
        ? withEditorReturnTo(getSectionHref(next.slug), returnTo)
        : getSectionHref(next.slug)
      if (`${window.location.pathname}${window.location.search}` === nextHref)
        return
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

  useRoadmapEditorDraftPersistence({
    hydrated:loadedStorageKey === storageKey,
    sections,
    drafts,
    setDrafts,
    storageKey,
    onDirtyChange,
    onRegisterDiscard,
  })

  const handleDraftChange = useCallback(
    (updates: Partial<RoadmapDraft>) => {
      if (!canEdit) return
      if (!activeSection) return
      setDrafts((prev) => ({
        ...prev,
        [activeSection.id]: {
          ...(prev[activeSection.id] ?? createDraft(activeSection)),
          ...updates,
        },
      }))
    },
    [activeSection, canEdit]
  )

  const applyAiProposal = useCallback((proposal: AiDocumentProposal) => applyRoadmapAiProposal({
    proposal,sourceScope,canEdit,busy: Boolean(savingId) || isPending || Boolean(conflicts[activeIdRef.current]),sectionsRef,draftsRef,activeIdRef,setDrafts,
  }),[canEdit,isPending,savingId,sourceScope,conflicts])

  const handleSave = useCallback(() => {
    if (!canEdit) return
    if (!activeSection) return
    saveSectionById({ sectionId: activeSection.id, showToast: true })
  }, [activeSection, canEdit, saveSectionById])

  useRoadmapEditorAutosave({
    canEdit:canEdit && loadedStorageKey === storageKey,
    activeSection,
    activeDraft,
    isDirty,
    bodyDirty,
    isPending,
    savingId,
    saveSectionById,
    flushActiveSectionDraft,
  })

  const handleStatusChange = useCallback(
    (nextStatus: RoadmapSectionStatus) => {
      if (!activeSection || activeDraft?.requiresPrivateSave) return
      saveSectionById({ sectionId: activeSection.id, showToast: false, status: nextStatus })
    },
    [activeSection, activeDraft?.requiresPrivateSave, saveSectionById]
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
    statusSelectDisabled: Boolean(conflicts[activeId]) || isPending || Boolean(savingId) || Boolean(activeDraft?.requiresPrivateSave),
    isHydrated,
    isCalendarSection,
    isBudgetSection,
    contentMaxWidth,
    editorPlaceholder,
    handleDraftChange,
    handleImageUpload: uploadRoadmapImage,
    handleSave,
    isDirty,
    savingId,
    handleStatusChange,
    applyAiProposal,
    aiApplication,
    saveConflict:conflicts[activeId] ?? null,
    resolveSaveConflict:(choice)=>resolveConflict(activeId,choice),
  }
}
