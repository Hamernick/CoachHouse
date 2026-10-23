"use client"
import { useCallback, type Dispatch, type SetStateAction } from "react"
import type { RoadmapSection } from "@/lib/roadmap"
import type { RoadmapDraft } from "../types"
import { createDraft } from "../helpers"

export function useRoadmapSavedSection(
  setSections: Dispatch<SetStateAction<RoadmapSection[]>>,
  setDrafts: Dispatch<SetStateAction<Record<string, RoadmapDraft>>>,
) {
  return useCallback((next: RoadmapSection) => {
    setSections(previous => previous.map(section => section.id === next.id ? next : section))
    setDrafts(previous => ({ ...previous, [next.id]: createDraft(next) }))
  }, [setDrafts, setSections])
}
