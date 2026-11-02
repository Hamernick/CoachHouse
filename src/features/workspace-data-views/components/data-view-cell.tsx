"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataViewSelect, DataViewOption } from "./data-view-select"
import type { DataColumn } from "../lib/schema"
import { parseDataCell } from "../lib/import"

export function DataViewCell({ column, value, revision, writable, pending, canStartEdit = true, onSave, onDirty }: {
  column: DataColumn; value: string | number | boolean | null | undefined; revision: string; writable: boolean; pending: boolean; canStartEdit?: boolean;
  onSave: (value: string | number | boolean | null, revision: string) => Promise<boolean>; onDirty: (dirty: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [baseRevision, setBaseRevision] = useState(revision)
  const [error, setError] = useState<string | null>(null)
  const formatted = value == null ? "Empty" : typeof value === "number" ? value.toLocaleString() : String(value)
  if (!writable || !column.writable) return <span className="text-muted-foreground break-words" title="Read only">{formatted}</span>
  if (!editing) return <Button variant="ghost" disabled={pending || !canStartEdit} className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" aria-label={`Edit ${column.label}: ${formatted}`} onClick={() => { setDraft(value == null ? "" : String(value)); setBaseRevision(revision); setEditing(true); onDirty(true) }}>{formatted}</Button>
  return <form className="flex min-w-44 flex-col gap-2" onSubmit={async event => {
    event.preventDefault(); setError(null)
    try { if (await onSave(parseDataCell(column, draft), baseRevision)) { setEditing(false); onDirty(false) } }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the value.") }
  }}>
    {column.type === "select" || column.type === "boolean" ? <DataViewSelect autoFocus aria-label={column.label} value={draft} onChange={event => setDraft(event.target.value)}><DataViewOption value="">Empty</DataViewOption>{(column.type === "boolean" ? ["true", "false"] : column.options).map(option => <DataViewOption key={option} value={option}>{option}</DataViewOption>)}</DataViewSelect>
      : <Input autoFocus aria-label={column.label} aria-invalid={Boolean(error)} type={column.type === "date" ? "date" : "text"} inputMode={column.type === "number" ? "decimal" : "text"} value={draft} maxLength={4000} onChange={event => setDraft(event.target.value)} />}
    {baseRevision !== revision && <p className="text-xs" role="status">Source changed. Saved value: {formatted}. Your draft is preserved. <Button type="button" variant="link" onClick={() => setBaseRevision(revision)}>Use latest revision</Button></p>}
    {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
    <div className="flex gap-2"><Button size="sm" type="submit" disabled={pending}>Save cell</Button><Button size="sm" type="button" variant="ghost" disabled={pending} onClick={() => { setEditing(false); onDirty(false) }}>Cancel</Button></div>
  </form>
}
