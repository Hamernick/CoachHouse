"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PdfPageLike } from "@/components/training/module-detail/deck-viewer/hooks/use-deck-canvas-renderer-types"

type PdfDocument = {
  numPages: number
  getPage: (page: number) => Promise<PdfPageLike>
}
type PdfLoadingTask = {
  promise: Promise<PdfDocument>
  destroy: () => Promise<void>
}

export function DocumentPdfViewer({
  url,
  name,
  onError,
  rasterSize = 1600,
  currentPage,
  onPageChange,
}: {
  url: string
  name: string
  currentPage?: number
  onPageChange?: (page: number) => void
  rasterSize?: number
  onError: () => void
}) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [localPage, setLocalPage] = useState(1)
  const page = currentPage ?? localPage
  const setPage = (next: number) => {
    setLocalPage(next)
    onPageChange?.(next)
  }
  const reduced = useReducedMotion()
  const [renderedPage, setRenderedPage] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PdfLoadingTask | undefined
    const timeout = setTimeout(() => {
      if (!cancelled) {
        cancelled = true
        onError()
        void loadingTask?.destroy().catch(() => undefined)
      }
    }, 15000)
    async function load() {
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
        if (!cancelled) setPdf(document)
      } catch {
        if (!cancelled) onError()
      } finally {
        clearTimeout(timeout)
      }
    }
    void load()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      void loadingTask?.destroy().catch(() => undefined)
    }
  }, [onError, url])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    let renderTask: ReturnType<PdfPageLike["render"]> | undefined
    async function render() {
      try {
        const source = await pdf!.getPage(page)
        if (cancelled) return
        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context) throw new Error("Canvas unavailable")
        const original = source.getViewport({ scale: 1 })
        const viewport = source.getViewport({
          scale: rasterSize / Math.max(original.width, original.height),
        })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        renderTask = source.render({ canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) setRenderedPage(page)
      } catch {
        if (!cancelled) onError()
      }
    }
    void render()
    return () => {
      cancelled = true
      renderTask?.cancel?.()
    }
  }, [onError, page, pdf, rasterSize])

  const busy = !pdf || renderedPage !== page
  return (
    <div className="flex size-full min-h-0 flex-col gap-2 p-2">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <motion.canvas
          animate={{ opacity: busy ? 0 : 1 }}
          transition={{ duration: reduced ? 0 : 0.12 }}
          ref={canvasRef}
          role="img"
          aria-label={`${name}, page ${page}`}
          data-preview-page={renderedPage ?? undefined}
          className="size-full object-contain"
        />
        {busy ? (
          <Skeleton
            className="absolute inset-0 motion-reduce:animate-none"
            aria-label="Loading PDF page"
          />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-8"
          aria-label="Previous page"
          disabled={busy || page === 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span
          className="text-muted-foreground text-sm tabular-nums"
          aria-live="polite"
        >
          {pdf ? `${page} / ${pdf.numPages}` : "Loading…"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-8"
          aria-label="Next page"
          disabled={busy || !pdf || page === pdf.numPages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
