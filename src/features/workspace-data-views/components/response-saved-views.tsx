"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { responseViewDirectorySchema } from "../lib/response-source"
import { runDataViewCommand } from "../source-actions"
import { WorkspaceDataViewsPanel } from "./workspace-data-views-panel"

export function ResponseSavedViews({ versionId, onDirtyChange }: { versionId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [directory, setDirectory] = useState<ReturnType<typeof responseViewDirectorySchema.parse> | null>(null)
  const [selected, setSelected] = useState("")
  const [name, setName] = useState("Response table")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [request, setRequest] = useState<{ viewId: string; requestId: string; name: string } | null>(null)
  const load = useCallback(async () => {
    const result = await runDataViewCommand({ action: "response_views", versionId })
    if (!result.ok) { setDirectory(null); setError(result.error); return }
    const parsed = responseViewDirectorySchema.safeParse(result.data)
    if (parsed.success) { setDirectory(parsed.data); setError("") } else setError("Response views unavailable.")
  }, [versionId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { onDirtyChange?.(dirty || pending || Boolean(request)); return () => onDirtyChange?.(false) }, [dirty, pending, request, onDirtyChange])
  return <section aria-label="Saved response views" className="flex min-w-0 flex-col gap-3">
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {!directory ? <Button variant="outline" onClick={() => void load()}>Reload response views</Button> : <>
      <div className="flex flex-wrap gap-2">{directory.views.map(view => <Button key={view.id} variant={view.id === selected ? "secondary" : "outline"} disabled={dirty || pending || Boolean(request)} onClick={() => setSelected(view.id)}>{view.name}</Button>)}</div>
      {directory.canCreate && !selected && <form className="flex flex-wrap gap-2" onSubmit={async event => {
        event.preventDefault(); if (pending) return
        const next = request ?? { viewId: crypto.randomUUID(), requestId: crypto.randomUUID(), name }
        setRequest(next); setPending(true)
        const result = await runDataViewCommand({ action: "create_view", organizationId: directory.organizationId, ...next, source: { kind: "responses", versionId } })
        setPending(false)
        if (!result.ok) { setError(result.error); if (result.code !== "unavailable") setRequest(null); return }
        setRequest(null); setSelected(next.viewId); await load()
      }}><Input aria-label="Response view name" className="min-w-24 flex-1" maxLength={100} value={name} disabled={Boolean(request)} onChange={event => setName(event.target.value)} /><Button type="submit" disabled={pending}>{request ? "Retry same creation" : "Create response view"}</Button></form>}
      {selected && <><Button variant="ghost" disabled={dirty || pending} onClick={() => setSelected("")}>All saved views</Button><WorkspaceDataViewsPanel key={selected} organizationId={directory.organizationId} viewId={selected} onDirtyChange={setDirty} /></>}
      {!selected && !directory.canCreate && directory.views.length === 0 && <p className="text-muted-foreground text-sm">A form editor can create a saved response view. Your current response access is unchanged.</p>}
    </>}
  </section>
}
