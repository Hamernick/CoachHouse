"use client"

import { createContext, useContext, useLayoutEffect, useMemo } from "react"
import type { ParticleGraph } from "@/features/workspace-particles"
import { emptyCanvasSourceReferences, particleSourceReferences, type CanvasSourceReferences } from "@/lib/workspace/canvas-source-references"

export const CanvasSourceContext = createContext<((sources: CanvasSourceReferences, reopen?: boolean) => void) | null>(null)

export function useCanvasParticleSources(graph: ParticleGraph | null) {
  const sources = useMemo(() => graph ? particleSourceReferences(graph) : null, [graph])
  useCanvasSources(sources)
}

/** Register canonical native-file/editor IDs, never a title, preview URL or
 * guessed library key. The canvas retains them after the window closes so
 * hidden windows, draft history and undo remain covered by revalidation.
 * Outside a canvas, the owning document surface keeps its existing authority. */
export function useCanvasDocumentSource(kind: "file" | "editor", id: string | null | undefined) {
  const sources = useMemo(() => {
    if (!id) return null
    const next = emptyCanvasSourceReferences()
    next[kind === "file" ? "files" : "documents"] = [id]
    return next
  }, [kind, id])
  useCanvasSources(sources, true)
}

function useCanvasSources(sources: CanvasSourceReferences | null, reopen = false) {
  const register = useContext(CanvasSourceContext)
  useLayoutEffect(() => { if (sources) register?.(sources, reopen) }, [register, sources, reopen])
}
