"use client"

import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react"

import { type RoadmapSection } from "@/lib/roadmap"

import { createDraftMap, isRoadmapDraftDirty, persistRoadmapDraftsToStorage } from "../helpers"
import { type RoadmapDraft } from "../types"

type UseRoadmapEditorDraftPersistenceArgs = {
  hydrated:boolean
  sections: RoadmapSection[]
  drafts: Record<string, RoadmapDraft>
  setDrafts: Dispatch<SetStateAction<Record<string, RoadmapDraft>>>
  storageKey: string
  onDirtyChange?: (isDirty: boolean) => void
  onRegisterDiscard?: (discard: (() => void) | null) => void
}

export function useRoadmapEditorDraftPersistence({
  hydrated,
  sections,
  drafts,
  setDrafts,
  storageKey,
  onDirtyChange,
  onRegisterDiscard,
}: UseRoadmapEditorDraftPersistenceArgs) {
  const hasUnsavedChanges = useMemo(
    () =>
      sections.some((section) => {
        const draft = drafts[section.id]
        if (!draft) return false
        return isRoadmapDraftDirty(section, draft)
      }),
    [sections, drafts],
  )

  const discardDrafts = useCallback(() => {
    setDrafts(() => createDraftMap(sections))
  }, [sections, setDrafts])

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  useEffect(() => {
    onRegisterDiscard?.(discardDrafts)
    return () => onRegisterDiscard?.(null)
  }, [onRegisterDiscard, discardDrafts])

  useEffect(() => {
    if (!hydrated) return
    persistRoadmapDraftsToStorage({ storageKey, sections, drafts })
  }, [drafts, sections, storageKey, hydrated])
}
