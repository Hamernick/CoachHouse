"use client"

import { RichTextEditor } from "@/components/rich-text-editor"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import type { DocumentSnapshot } from "../types"
import { useDocumentMarkdown } from "../hooks/use-document-markdown"

/** Complete-content read surface. Editing is wired only after the authorized,
 * durable collaboration session is available; no temporary whole-file writer. */
export function DocumentEditingPanel({ snapshot, active = true }: {
  snapshot: DocumentSnapshot; active?: boolean
}) {
  const parsed = useDocumentMarkdown(snapshot, active)
  if (parsed.loading) return (
    <div role="status" aria-label="Loading document" className="flex min-h-96 flex-col gap-3 p-4">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
  if (!parsed.document) return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-muted-foreground text-sm">{parsed.reason}</p>
      <Textarea readOnly value={snapshot.content} aria-label={snapshot.name}
        className="nodrag nopan nowheel min-h-96 resize-none font-mono" />
    </div>
  )
  return (
    <RichTextEditor key={parsed.key} value="" onChange={() => undefined} readOnly
      ariaLabel={snapshot.name} preserveImages disableResize
      className="nodrag nopan nowheel rounded-none border-0 shadow-none"
      session={{ initialContent: parsed.document, active, history: "local", onUpdate: () => undefined }} />
  )
}
