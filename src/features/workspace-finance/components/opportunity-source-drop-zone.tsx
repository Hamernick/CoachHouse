"use client"
import { useRef, useState, type ReactNode } from "react"
import { useParticleLibraryDropTarget, uploadParticleFile, particleFileError, PARTICLE_FILE_ACCEPT } from "@/features/workspace-particles/client"
import { getWorkspaceOpportunitySources } from "@/actions/workspace-opportunity-sources"
import { sourceKey, type OpportunitySource, type OpportunitySourceOption } from "../lib/opportunity-sources"
import { opportunityDocumentDrop } from "../lib/opportunity-document-drop"

export function OpportunitySourceDropZone({ children, organizationId, value, onChange, onOptionsAdded, disabled, onBusyChange, accept = PARTICLE_FILE_ACCEPT, validateFile }: {
  accept?: string; validateFile?: (file: File) => string | null
  children: (openFiles: () => void) => ReactNode; organizationId: string; value: OpportunitySource[]; onChange: (value: OpportunitySource[]) => void
  onOptionsAdded: (options: OpportunitySourceOption[]) => void; disabled: boolean; onBusyChange: (busy: boolean) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const uploads = useRef(new Map<string, OpportunitySourceOption>())
  const depth = useRef(0)
  const [over, setOver] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useParticleLibraryDropTarget(root, async item => {
    if (disabled || busy.current) return false
    if (value.length >= 20) { setError("You can add up to 20 sources."); return false }
    busy.current = true; onBusyChange(true); setError(null); setStatus("Attaching document…")
    try {
      const result = await getWorkspaceOpportunitySources(organizationId)
      if (!result.options) throw new Error(result.error)
      const source = opportunityDocumentDrop(item.request, organizationId, result.options)
      if (!source) throw new Error("This document is unavailable in this organization.")
      if (source.kind !== "link" && !result.options.some(option => sourceKey(option.source) === sourceKey(source))) throw new Error("This document is no longer available. Refresh Documents and try again.")
      onOptionsAdded(result.options)
      onChange([...new Map([...value, source].map(entry => [sourceKey(entry), entry])).values()])
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to attach this document."); return false }
    finally { busy.current = false; onBusyChange(false); setStatus(null) }
  })
  async function upload(files: File[]) {
    if (disabled || busy.current || !files.length) return
    if (files.length + value.length > 20) { setError("You can add up to 20 sources."); return }
    busy.current = true; onBusyChange(true); setError(null)
    const next = [...value]
    const failures: string[] = []
    try {
      for (const file of files) {
        try {
          const invalid = validateFile?.(file) || particleFileError(file)
          if (invalid) throw new Error(invalid)
          setStatus(`Uploading ${file.name}…`)
          const key = `${file.name}:${file.size}:${file.lastModified}`
          let option = uploads.current.get(key)
          if (!option) {
            const uploaded = await uploadParticleFile(organizationId, file)
            option = { source: { kind: "file", id: uploaded.fileId }, title: file.name, mimeType: file.type, category: "Document", description: `${file.type || "Document"} · ${Math.ceil(file.size / 1024)} KB` }
            uploads.current.set(key, option)
          }
          if (!next.some(source => sourceKey(source) === sourceKey(option.source))) next.push(option.source)
          onOptionsAdded([option]); onChange([...next])
        } catch (cause) { failures.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed. Try again."}`) }
      }
      if (failures.length) setError(failures.join(" "))
    } finally { busy.current = false; onBusyChange(false); setStatus(null) }
  }
  return <div ref={root} data-opportunity-sources-drop="true" data-drag-over={over || undefined} className="relative min-w-0 rounded-xl transition-colors data-[drag-over=true]:bg-accent data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-ring data-[library-drag-over=true]:bg-accent data-[library-drag-over=true]:ring-2 data-[library-drag-over=true]:ring-ring motion-reduce:transition-none"
    onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.stopPropagation(); depth.current += 1; setOver(true) } }}
    onDragLeave={event => { if (event.dataTransfer.types.includes("Files")) { event.stopPropagation(); depth.current -= 1; if (depth.current <= 0) setOver(false) } }}
    onDragOver={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = disabled || busy.current ? "none" : "copy" } }}
    onDrop={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.stopPropagation(); depth.current = 0; setOver(false); void upload(Array.from(event.dataTransfer.files)) } }}>
    {children(() => input.current?.click())}
    <input ref={input} type="file" multiple accept={accept} className="hidden" aria-label="Choose source files" disabled={disabled} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files) }} />
    {status && <p role="status" className="pr-10 text-xs text-muted-foreground">{status}</p>}
    {error && <p role="alert" className="pr-10 text-xs text-destructive">{error}</p>}
  </div>
}
