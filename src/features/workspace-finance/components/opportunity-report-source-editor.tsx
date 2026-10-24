"use client"
import { useRef, useState } from "react"
import type { OpportunitySource, OpportunitySourceOption } from "../lib/opportunity-sources"
import { OpportunitySourcesInput } from "./opportunity-sources-input"
import { OpportunitySourceDropZone } from "./opportunity-source-drop-zone"

export type ReportSourceEditorProps = {
  organizationId: string; options: OpportunitySourceOption[]; loadOptions: () => void; loading: boolean; error: string | null
  onOptionsAdded: (options: OpportunitySourceOption[]) => void; onBusyChange: (value: boolean) => void; disabled: boolean
}
export function OpportunityReportSourceEditor({ value, onChange, imageOnly = false, ...props }: ReportSourceEditorProps & {
  value: OpportunitySource[]; onChange: (value: OpportunitySource[]) => void; imageOnly?: boolean
}) {
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const options = useRef(props.options)
  options.current = props.options
  const update = (next: OpportunitySource[]) => {
    if (imageOnly && next.some(source => source.kind !== "file" || !options.current.some(option => option.source.kind === "file" && option.source.id === source.id && /^image\/(jpeg|png|webp|gif)$/.test(option.mimeType ?? "")))) { setError("Choose a JPEG, PNG, WebP, or GIF image."); return }
    setError(null); onChange(imageOnly ? next.slice(-1) : next)
  }
  return <div className="min-w-0"><OpportunitySourceDropZone accept={imageOnly ? "image/jpeg,image/png,image/webp,image/gif" : undefined} validateFile={imageOnly ? file => /^image\/(jpeg|png|webp|gif)$/.test(file.type) ? null : "Choose a JPEG, PNG, WebP, or GIF image." : undefined} organizationId={props.organizationId} value={value} onChange={update} onOptionsAdded={added => { options.current = [...options.current, ...added]; props.onOptionsAdded(added) }} disabled={props.disabled} onBusyChange={props.onBusyChange}>
    {openFiles => <OpportunitySourcesInput {...props} value={value} onChange={update} query={query} onQueryChange={setQuery} onAttachFiles={openFiles} options={imageOnly ? props.options.filter(option => option.mimeType?.startsWith("image/")) : props.options} commitOnBlur />}
  </OpportunitySourceDropZone>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>
}
