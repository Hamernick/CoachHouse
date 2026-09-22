"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RoadmapSection } from "@/lib/roadmap/types"
import { buildParticleSources } from "../lib"
import type {
  ParticleActivity,
  ParticleCalendarEvent,
  ParticleDriveDocument,
  ParticleImage,
  ParticleOrganization,
  ParticleProgram,
} from "../types"

export function useParticleSources(
  sections: RoadmapSection[],
  images: ParticleImage[],
  organization?: ParticleOrganization,
  activities?: ParticleActivity[],
  programs?: ParticleProgram[],
  calendarEvents?: ParticleCalendarEvent[],
  loadDriveDocuments?: () => Promise<ParticleDriveDocument[]>
) {
  const [savedSections, setSavedSections] = useState<
    Record<string, RoadmapSection>
  >({})
  const updateRoadmapSection = useCallback(
    (section: RoadmapSection) =>
      setSavedSections((current) => ({ ...current, [section.id]: section })),
    []
  )
  const [documents, setDocuments] = useState<ParticleDriveDocument[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const abortRef = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("loading")
    try {
      if (loadDriveDocuments) {
        const loaded = await loadDriveDocuments()
        if (!controller.signal.aborted) {
          setDocuments(loaded)
          setStatus("ready")
        }
        return
      }
      const response = await fetch("/api/integrations/google-drive/documents", {
        cache: "no-store",
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.documents))
        throw new Error("unavailable")
      if (controller.signal.aborted) return
      setDocuments(
        data.documents.filter(
          (doc: ParticleDriveDocument) =>
            doc &&
            typeof doc.id === "string" &&
            /^[a-zA-Z0-9_-]{1,160}$/.test(doc.id) &&
            typeof doc.fileId === "string" &&
            /^[a-zA-Z0-9_-]{1,160}$/.test(doc.fileId) &&
            typeof doc.name === "string" &&
            typeof doc.mimeType === "string"
        )
      )
      setStatus("ready")
    } catch {
      if (controller.signal.aborted) return
      setDocuments([])
      setStatus("error")
    }
  }, [loadDriveDocuments])
  useEffect(() => {
    void refresh()
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      abortRef.current?.abort()
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])
  const sources = useMemo(
    () =>
      buildParticleSources(
        sections.map((section) => {
          const saved = savedSections[section.id]
          return saved &&
            Date.parse(saved.lastUpdated ?? "") >=
              Date.parse(section.lastUpdated ?? "1970-01-01")
            ? saved
            : section
        }),
        documents,
        images,
        organization,
        activities,
        programs,
        calendarEvents
      ),
    [
      sections,
      savedSections,
      documents,
      images,
      organization,
      activities,
      programs,
      calendarEvents,
    ]
  )
  return {
    sources,
    driveStatus: status,
    refreshDrive: refresh,
    updateRoadmapSection,
  }
}
