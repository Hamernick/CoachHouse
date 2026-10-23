"use client"

import { useEffect, useState } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { RichTextEditor } from "@/components/rich-text-editor"
import type { RichTextEditorProps } from "@/components/rich-text-editor/types"
import { Button } from "@/components/ui/button"
import type { RoadmapSection } from "@/lib/roadmap"
import { GoogleDriveMark } from "./google-drive-mark"
import type { CoreDocumentScope } from "./use-core-document-source"

type Props = {
  scope: CoreDocumentScope
  section: RoadmapSection
  editorProps?: RichTextEditorProps
  onReplace?: () => void
  replacing?: boolean
}

export function LinkedDriveDocumentEditor({ scope, section, editorProps, onReplace, replacing = false }: Props) {
  const linked = section.driveSource
  const query = new URLSearchParams({
    organizationId: scope.organizationId,
    userId: scope.userId,
    sectionId: section.id,
    fileId: linked?.fileId ?? "",
    revision: section.lastUpdated ?? "",
  }).toString()
  const [result, setResult] = useState<{ query: string; content?: string; error?: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const current = result?.query === query ? result : null
  const loading = !current

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    void (async () => {
      try {
        const response = await fetch(`/api/integrations/google-drive/roadmap-content?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json()
        if (!response.ok || typeof payload.content !== "string") {
          if (!controller.signal.aborted) setResult({ query, error: payload?.code === "unsupported_preview"
            ? "Preview supports Google Docs, text, and Markdown files. Open this file in Google Drive."
            : "Unable to read this file. Check your Google Drive connection in Tools or open the original." })
          return
        }
        if (!controller.signal.aborted) setResult({ query, content: payload.content })
      } catch {
        if (!controller.signal.aborted) setResult({ query, error: "Unable to read this file. Try again or open the original in Google Drive." })
      }
    })()
    return () => controller.abort()
  }, [query, attempt])

  if (!linked) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2 px-3 text-xs text-muted-foreground">
        {loading ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" role="status" aria-label="Loading Google Drive document" /> : <GoogleDriveMark />}
        <a className="min-w-0 truncate underline-offset-2 hover:underline" href={linked.webViewLink} target="_blank" rel="noopener noreferrer" title={`Open ${linked.name} in Google Drive`}>{linked.name}</a>
        <span className="shrink-0">View only</span>
        {onReplace ? <Button type="button" variant="ghost" size="icon" className="ml-auto size-11 shrink-0 sm:size-8" onClick={onReplace} disabled={replacing} aria-label="Replace Google Drive document" title="Replace Google Drive document">
          {replacing ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : <GoogleDriveMark />}
        </Button> : null}
      </div>
      {current?.error ? <div className="px-3 py-2 text-sm"><p role="alert">{current.error}</p><Button type="button" variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></div> : null}
      <RichTextEditor {...editorProps} value={current?.content ?? ""} onChange={() => {}} readOnly ariaLabel={`${section.title}, Google Drive document, view only`} toolbarActions={null} toolbarTrailingActions={null} onImageUpload={undefined} onImageUploaded={undefined} onReady={undefined} onImagePickerReady={undefined} linkPreviews={false} preserveImages={false} applyExternalValue placeholder="" />
    </div>
  )
}
