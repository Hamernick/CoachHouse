"use client"
import { useCallback, useEffect, useState } from "react"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspaceDataViewsController } from "../hooks/use-workspace-data-views-controller"
import { DataViewSourcePicker } from "./data-view-source-picker"
import { DataViewSettings } from "./data-view-settings"
import { DataViewResponseCell } from "./data-view-response-cell"
import { responseQuestionKey } from "../lib/response-source"
import { DataViewCell } from "./data-view-cell"

export function WorkspaceDataViewsPanel({ organizationId, viewId, expanded = true, editable = true, onOpen, onDirtyChange }: {
  organizationId: string; viewId: string; expanded?: boolean; editable?: boolean; onOpen?: () => void; onDirtyChange?: (dirty: boolean) => void
}) {
  const controller = useWorkspaceDataViewsController(organizationId, viewId)
  const { data, pending, error, uncertain, mutate, load, page, setPage, setError } = controller
  const [settings, setSettings] = useState(false)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const hasDrafts = Object.values(dirty).some(Boolean)
  useWorkspaceEditorStatus({ label: "Data view", dirty: hasDrafts || Boolean(uncertain), pending, error: Boolean(error) })
  useEffect(() => { onDirtyChange?.(hasDrafts || Boolean(uncertain)); return () => onDirtyChange?.(false) }, [hasDrafts, uncertain, onDirtyChange])
  const markSettingsDirty = useCallback((value: boolean) => setDirty(current => ({ ...current, settings: value })), [])
  useEffect(() => {
    if (!hasDrafts && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [hasDrafts, uncertain])
  const target = { organizationId, viewId }
  const writable = editable && data?.canEdit && !uncertain
  if (!expanded) return <div className="flex flex-col gap-2"><p className="text-muted-foreground text-sm">{error ? "Source unavailable" : data?.view ? `${data.total} records · ${data.view.name}` : "Choose a source for this saved view."}</p><Button variant="outline" onClick={onOpen}>Open data view</Button></div>
  return <section aria-label="Saved data view" className="nodrag nopan nowheel flex min-w-0 flex-col gap-3">
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {uncertain && <Button disabled={pending} onClick={() => void mutate(uncertain)}>Retry the same request</Button>}
    {!data ? <><p className="text-muted-foreground text-sm" role="status">{error ? "Data unavailable. Saved drafts remain in this view." : "Loading saved view…"}</p><Button variant="outline" disabled={pending} onClick={() => void load()}>Reload source</Button></> : !data.view ? writable ? <DataViewSourcePicker {...target} pending={pending} onCreate={mutate} onError={setError} /> : <p className="text-muted-foreground text-sm">An editor can configure this saved view.</p> : <>
      <div className="flex flex-wrap items-center gap-2"><strong className="min-w-0 flex-1 truncate">{data.view.name}</strong><Button variant="outline" disabled={pending} onClick={() => void load()}>Refresh</Button>{writable && <Button variant="outline" disabled={hasDrafts} onClick={() => setSettings(value => !value)}>{settings ? "Hide settings" : "View settings"}</Button>}</div>
      {settings && writable && <DataViewSettings key={data.view.id} initial={data.view.config} revision={data.view.revision} columns={data.columns} pending={pending} onDirty={markSettingsDirty} onSave={async (config, revision) => { const success = await mutate({ ...target, action: "save_view", requestId: crypto.randomUUID(), revision, config }); if (success) { setSettings(false); setPage(0) } return success }} />}
      {data.sheetSource && <p className="text-muted-foreground text-xs">Linked Sheet: {data.sheetSource.title} / {data.sheetSource.sheetTitle} · Reading as {data.sheetSource.email}. Fixed range: row {data.sheetSource.range.startRow}, {data.sheetSource.range.rowCount - 1} data rows, {data.sheetSource.range.columnCount} columns. Cells are read-only. <a className="underline underline-offset-2" href={data.sheetSource.url} target="_blank" rel="noopener noreferrer">Open in Sheets</a></p>}
      {data.provenance?.kind === "csv_copy" && <p className="text-muted-foreground text-xs">Imported copy of {String(data.provenance.filename)} · {String(data.provenance.rowCount)} original rows. The original file is unchanged.</p>}
      <div className="max-w-full overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{data.view.config.columns.map(key => <TableHead key={key}>{data.columns.find(column => column.key === key)?.label}</TableHead>)}</TableRow></TableHeader><TableBody>
        {data.rows.map(row => <TableRow key={row.id}>{data.view!.config.columns.map(key => { const column = data.columns.find(item => item.key === key)!; const question = data.responseSource?.version.definition.questions.find(item => responseQuestionKey(item.id) === key); const response = data.responseSource?.responses.find(item => item.id === row.id); return <TableCell key={key} className="max-w-80 align-top"><>{question && response ? <DataViewResponseCell question={question} response={response} display={String(row.values[key] ?? "")} writable={Boolean(writable)} pending={pending} canStartEdit={!hasDrafts && !settings} onDirty={value => setDirty(current => ({ ...current, [`${row.id}:${key}`]: value }))} onSave={(value, revision) => mutate({ ...target, action: "edit_response_cell", requestId: crypto.randomUUID(), rowId: row.id, questionId: question.id, revision, value })} /> : <DataViewCell column={column} value={data.view!.source === "responses" && key === "submitted_at" ? new Date(String(row.values[key])).toLocaleString() : row.values[key]} revision={row.revision} writable={Boolean(writable)} pending={pending} canStartEdit={!hasDrafts && !settings} onDirty={value => setDirty(current => ({ ...current, [`${row.id}:${key}`]: value }))} onSave={async (value, revision) => mutate({ ...target, action: "edit_cell", requestId: crypto.randomUUID(), rowId: row.id, revision, column: key, value })} />}</></TableCell> })}</TableRow>)}
      </TableBody></Table></div>
      {data.rows.length === 0 && <p role="status" className="text-muted-foreground text-sm">{data.total === 0 ? "No records match this view." : "This page is empty. Return to the previous page."}</p>}
      <div className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground flex-1 text-xs tabular-nums">{data.total.toLocaleString()} records · page {page + 1}</span><Button variant="outline" disabled={page === 0 || pending || hasDrafts} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= 400 || (page + 1) * 25 >= data.total || pending || hasDrafts} onClick={() => setPage(value => value + 1)}>Next</Button></div>
      {writable && data.view.source === "table" && <Button variant="outline" disabled={pending} onClick={() => void mutate({ ...target, action: "add_row", requestId: crypto.randomUUID(), values: {} })}>Add empty row</Button>}
      {hasDrafts && <p role="status" className="text-muted-foreground text-xs">Unsaved edits stay here until you save or cancel.</p>}
    </>}
  </section>
}
