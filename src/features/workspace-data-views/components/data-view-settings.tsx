"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DataViewSelect, DataViewOption } from "./data-view-select"
import type { DataColumn, DataViewConfig } from "../lib/schema"

export function DataViewSettings({ columns, initial, revision, pending, onSave, onDirty }: {
  columns: DataColumn[]; initial: DataViewConfig; revision: number; pending: boolean; onSave: (config: DataViewConfig, revision: number) => Promise<boolean>; onDirty: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [baseRevision, setBaseRevision] = useState(revision)
  const change = (config: DataViewConfig) => { setDraft(config); onDirty(JSON.stringify(config) !== JSON.stringify(initial)) }
  return <form className="flex flex-col gap-3 rounded-lg border p-3" onSubmit={async event => { event.preventDefault(); if (await onSave(draft, baseRevision)) onDirty(false) }}>
    <fieldset className="flex flex-wrap gap-3"><legend className="mb-1 text-sm font-medium">Visible columns</legend>{columns.map(column => <label key={column.key} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={draft.columns.includes(column.key)} onCheckedChange={checked => change({ ...draft, columns: checked ? [...draft.columns, column.key] : draft.columns.filter(key => key !== column.key) })} />{column.label}</label>)}</fieldset>
    <div className="flex flex-wrap gap-2"><DataViewSelect aria-label="Sort column" value={draft.sort.column} onChange={event => change({ ...draft, sort: { ...draft.sort, column: event.target.value } })}>{columns.filter(column => column.queryable !== false).map(column => <DataViewOption key={column.key} value={column.key}>{column.label}</DataViewOption>)}</DataViewSelect>
      <DataViewSelect aria-label="Sort direction" value={draft.sort.direction} onChange={event => change({ ...draft, sort: { ...draft.sort, direction: event.target.value as "asc" | "desc" } })}><DataViewOption value="asc">Ascending</DataViewOption><DataViewOption value="desc">Descending</DataViewOption></DataViewSelect>
    </div>
    <div className="flex flex-wrap gap-2"><DataViewSelect aria-label="Filter column" value={draft.filter?.column ?? "none"} onChange={event => change({ ...draft, filter: event.target.value === "none" ? null : { column: event.target.value, value: draft.filter?.value ?? "" } })}><DataViewOption value="none">No filter</DataViewOption>{columns.filter(column => column.queryable !== false).map(column => <DataViewOption key={column.key} value={column.key}>{column.label} contains</DataViewOption>)}</DataViewSelect>
      {draft.filter && <Input aria-label="Filter contains" className="min-w-24 flex-1" value={draft.filter.value} maxLength={120} onChange={event => change({ ...draft, filter: { column: draft.filter!.column, value: event.target.value } })} />}
    </div>
    {baseRevision !== revision && <div role="status" className="text-xs">Saved settings changed: {initial.columns.map(key => columns.find(column => column.key === key)?.label).join(", ")}; {initial.sort.column} {initial.sort.direction}; filter {initial.filter ? `${initial.filter.column} contains ${initial.filter.value}` : "none"}. Your settings draft is preserved.<Button type="button" variant="link" onClick={() => setBaseRevision(revision)}>Use latest view revision</Button></div>}
    <Button type="submit" disabled={pending}>Save view settings</Button>
  </form>
}
