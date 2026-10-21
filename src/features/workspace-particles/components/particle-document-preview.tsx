"use client"

import { useCallback, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion, useReducedMotion } from "motion/react"
import { WorkspaceFileTable } from "@/components/workspace/workspace-file-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentPdfViewer } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-pdf-viewer"
import { useParticleDocumentContent } from "../hooks/use-particle-document-content"
import type { ParticleDocument } from "../lib/particle-file"
import { boundedDocumentText } from "../lib/particle-document-content"

export function ParticleDocumentPreview({
  file,
  url,
  expanded,
  retry,
  pdfPage,
  onPdfPageChange,
  text,
}: {
  file: ParticleDocument
  url: string
  expanded: boolean
  pdfPage: number
  onPdfPageChange: (page: number) => void
  retry: () => void
  text?: string | null
}) {
  const loaded = useParticleDocumentContent(url, file.format)
  const content =
    file.format === "roadmap" && text !== null && text !== undefined
      ? boundedDocumentText(text)
      : loaded.content
  const error = loaded.error
  const [pdfFailed, setPdfFailed] = useState(false)
  const reduced = useReducedMotion()
  const onPdfError = useCallback(() => setPdfFailed(true), [])
  const failure =
    error ||
    (pdfFailed
      ? `This ${file.format === "image" ? "image" : "PDF"} could not be displayed.`
      : null)
  if (failure)
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs"
      >
        <p>{failure}</p>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry preview
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </Button>
      </div>
    )
  if (file.format === "pdf")
    return (
      <DocumentPdfViewer
        url={url}
        name={file.name}
        onError={onPdfError}
        rasterSize={expanded ? 1600 : 640}
        currentPage={pdfPage}
        onPageChange={onPdfPageChange}
      />
    )
  if (file.format === "image")
    return (
      // Private document URLs bypass the public image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.name}
        draggable={false}
        className="size-full object-contain"
        loading="lazy"
        onError={onPdfError}
      />
    )
  if (file.format === "link")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm">
        <p>{file.name}</p>
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </Button>
      </div>
    )
  if (file.format === "doc")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm">
        <p>Save this Word document as .docx or PDF for an inline preview.</p>
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </Button>
      </div>
    )
  if (!content)
    return (
      <Skeleton
        className="h-full min-h-40 w-full motion-reduce:animate-none"
        role="status"
        aria-label="Loading file preview"
      />
    )
  const textPreview =
    content.kind === "text"
      ? expanded
        ? content.text
        : content.text.slice(0, 3000)
      : ""
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.12 }}
      className="flex h-full min-h-0 flex-col"
    >
      <div
        className={`min-h-0 flex-1 overflow-auto overscroll-contain ${expanded ? "p-5 sm:p-8" : "p-4"}`}
      >
        {content.kind === "table" ? (
          <WorkspaceFileTable key={url} rows={content.rows} title={file.name} compact={!expanded}/>
        ) : file.format === "md" || file.format === "roadmap" ? (
          <div className="prose prose-sm dark:prose-invert mx-auto max-w-3xl [overflow-wrap:anywhere] break-words">
            <Markdown
              skipHtml
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ alt }) => (
                  <span className="text-muted-foreground">
                    [{alt || "Image"}]
                  </span>
                ),
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {textPreview || "Empty document."}
            </Markdown>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl text-sm leading-relaxed break-words whitespace-pre-wrap">
            {textPreview || "Empty document."}
          </div>
        )}
      </div>
      {(content.truncated || file.format === "docx") && (
        <p className="text-muted-foreground shrink-0 px-4 py-2 text-xs">
          {content.truncated
            ? "Preview shortened. Open the original for the full file."
            : "Text preview · Open the original for Word formatting."}
        </p>
      )}
    </motion.div>
  )
}
