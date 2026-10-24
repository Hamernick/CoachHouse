"use client"
import type { ReactNode } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { OpportunityReportBlock } from "../lib/opportunity-report"
import { OpportunityReportImage } from "./opportunity-report-content"
import { OpportunityReportSourceEditor, type ReportSourceEditorProps } from "./opportunity-report-source-editor"

export function OpportunityReportImageEditor({ block, onChange, menu, editing, onClose, ...sources }: ReportSourceEditorProps & {
  block: Extract<OpportunityReportBlock, { kind: "image" }>; onChange: (block: Extract<OpportunityReportBlock, { kind: "image" }>) => void
  menu: ReactNode; editing: "source" | "description" | null; onClose: () => void
}) {
  return <div className="space-y-3">
    <div className="relative">
      {block.fileId && <OpportunityReportImage key={block.fileId} block={block} organizationId={sources.organizationId} />}
      <div className="absolute top-2 right-2 z-10">{menu}</div>
      {!block.fileId && <div className="pt-12" id={`report-source-${block.id}`} tabIndex={-1}><OpportunityReportSourceEditor {...sources} imageOnly value={[]} onChange={next => { onChange({ ...block, fileId: next[0]?.kind === "file" ? next[0].id : null }); if (next.length) onClose() }} /></div>}
    </div>
    {block.fileId && editing === "source" && <div id={`report-source-${block.id}`} tabIndex={-1}><OpportunityReportSourceEditor {...sources} imageOnly value={[{ kind: "file", id: block.fileId }]} onChange={next => { onChange({ ...block, fileId: next[0]?.kind === "file" ? next[0].id : null }); if (next.length) onClose() }} /></div>}
    {editing === "description" && <Textarea id={`report-description-${block.id}`} rows={1} aria-label="Image description" placeholder="Describe the image…" maxLength={240} value={block.alt} onChange={event => onChange({ ...block, alt: event.target.value })} onBlur={onClose} className="min-h-10 resize-none rounded-lg px-3 py-2 shadow-none" />}
  </div>
}
