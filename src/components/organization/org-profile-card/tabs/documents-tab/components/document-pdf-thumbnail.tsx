"use client"

import { useEffect, useRef, useState } from "react"
import type {
  PdfPageLike,
  PdfRenderTaskLike,
} from "@/components/training/module-detail/deck-viewer/hooks/use-deck-canvas-renderer-types"

type PdfLoadingTask = {
  promise: Promise<{ getPage: (page: number) => Promise<PdfPageLike> }>
  destroy: () => Promise<void>
}

export function DocumentPdfThumbnail({
  url,
  name,
  onError,
}: {
  url: string
  name: string
  onError: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PdfLoadingTask | undefined
    let renderTask: PdfRenderTaskLike | undefined
    async function render() {
      try {
        const { loadPdfJs } =
          await import("@/components/training/module-detail/deck-viewer/helpers")
        const pdfjs = await loadPdfJs()
        if (cancelled) return
        if (!pdfjs) throw new Error("PDF renderer unavailable")
        loadingTask = pdfjs.getDocument({
          url,
          isEvalSupported: false,
        }) as PdfLoadingTask
        const document = await loadingTask.promise
        if (cancelled) return
        const page = await document.getPage(1)
        if (cancelled) return
        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context) return
        const original = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({
          scale: 320 / Math.max(original.width, original.height),
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        renderTask = page.render({ canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) setReady(true)
      } catch {
        if (!cancelled) onError()
      }
    }
    void render()
    return () => {
      cancelled = true
      renderTask?.cancel?.()
      void loadingTask?.destroy().catch(() => undefined)
    }
  }, [onError, url])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${name} first page`}
      data-preview-ready={ready || undefined}
      className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
    />
  )
}
