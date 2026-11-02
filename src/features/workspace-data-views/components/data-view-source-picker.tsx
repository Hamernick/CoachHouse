"use client"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { DataViewSelect, DataViewOption } from "./data-view-select"
import { runDataViewCommand } from "../source-actions"
import { dataColumnsSchema, type DataColumn, type DataViewCommand, type DataRowValues } from "../lib/schema"
import { parseDataTableCsv } from "../lib/import"

export function DataViewSourcePicker({ organizationId, viewId, pending, onCreate, onError }: {
  organizationId: string; viewId: string; pending: boolean; onCreate: (command: DataViewCommand) => Promise<boolean>; onError: (error: string) => void
}) {
  const [source, setSource] = useState("projects")
  const [versionId, setVersionId] = useState("")
  const [name, setName] = useState("Projects")
  const [tables, setTables] = useState<{ id: string; name: string }[]>([])
  const [columns, setColumns] = useState<DataColumn[]>([{ key: "column_1", label: "Name", type: "text", options: [], writable: true }])
  const [imported, setImported] = useState<{ filename: string; rows: DataRowValues[] } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    let active = true
    void runDataViewCommand({ action: "sources", organizationId, viewId }).then(result => {
      if (!active) return
      if (!result.ok) { onError(result.error); return }
      const parsed = z.array(z.object({ id: z.uuid(), name: z.string() })).safeParse(result.data)
      if (parsed.success) setTables(parsed.data)
    })
    return () => { active = false }
  }, [organizationId, viewId, onError])
  return <form className="flex flex-col gap-3" onSubmit={async event => {
    event.preventDefault()
    try {
      const selected: Extract<DataViewCommand, { action: "create_view" }>["source"] = source === "responses" ? { kind: "responses", versionId: z.uuid().parse(versionId.trim().split("/").at(-1)) } : source === "projects" ? { kind: "projects" }
        : source === "new" || source === "import" ? { kind: "new_table", columns: dataColumnsSchema.parse(columns), rows: imported?.rows ?? [],
          provenance: { kind: imported ? "csv_copy" : "new", filename: imported?.filename ?? null, rowCount: imported?.rows.length ?? 0 }, audienceConfirmed: true }
        : { kind: "table", tableId: source }
      if ((source === "new" || source === "import") && !confirmed) throw new Error("Review and confirm the audience before creating a table.")
      if (source === "import" && !imported) throw new Error("Choose a CSV file to review.")
      await onCreate({ action: "create_view", organizationId, viewId, requestId: crypto.randomUUID(), name, source: selected })
    } catch (error) { onError(error instanceof Error ? error.message : "Check the source.") }
  }}>
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${viewId}-source`}>Source</FieldLabel><DataViewSelect id={`${viewId}-source`} value={source} onChange={event => { const value = event.target.value; setSource(value); setImported(null); setConfirmed(false); setName(value === "projects" ? "Projects" : "My table") }} disabled={pending}>
        <DataViewOption value="projects">Coach House projects</DataViewOption>
        <DataViewOption value="responses">Private form responses…</DataViewOption>
        <DataViewOption value="new">New workspace table</DataViewOption>
        <DataViewOption value="import">Import a CSV copy…</DataViewOption>
        {tables.map(table => <DataViewOption key={table.id} value={table.id}>{table.name}</DataViewOption>)}
      </DataViewSelect></Field>
      <Field><FieldLabel htmlFor={`${viewId}-name`}>View name</FieldLabel><Input id={`${viewId}-name`} name="view-name" autoComplete="off" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></Field>
    </FieldGroup>
    {source === "responses" && <Field><FieldLabel htmlFor={`${viewId}-version`}>Response version ID or response page URL</FieldLabel><Input id={`${viewId}-version`} value={versionId} autoComplete="off" onChange={event => setVersionId(event.target.value)} /><p className="text-muted-foreground text-xs">Only this form’s authorized collaborators can access its answers. Workspace ownership does not grant access.</p></Field>}
    {source === "new" && <div className="flex flex-col gap-2"><p className="text-muted-foreground text-xs">Declare columns before creating the table.</p>{columns.map((column, index) => <div key={column.key} className="flex flex-wrap gap-2">
      <Input className="min-w-24 flex-1" aria-label={`Column ${index + 1} name`} value={column.label} maxLength={80} onChange={event => setColumns(current => current.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} />
      <DataViewSelect aria-label={`Column ${index + 1} type`} value={column.type} onChange={event => setColumns(current => current.map((item, position) => position === index ? { ...item, type: event.target.value as DataColumn["type"] } : item))}>
        {(["text", "number", "boolean", "date", "select"] as const).map(type => <DataViewOption key={type} value={type}>{type}</DataViewOption>)}
      </DataViewSelect>
      {column.type === "select" && <Input aria-label={`Column ${index + 1} options, comma separated`} placeholder="First option, second option…" value={column.options.join(",")} onChange={event => setColumns(current => current.map((item, position) => position === index ? { ...item, options: event.target.value.split(",") } : item))} />}
    </div>)}<Button type="button" variant="outline" disabled={columns.length >= 12 || pending} onClick={() => setColumns(current => [...current, { key: `column_${current.length + 1}`, label: `Column ${current.length + 1}`, type: "text", options: [], writable: true }])}>Add column</Button></div>}
    {source === "import" && <Field><FieldLabel htmlFor={`${viewId}-file`}>CSV file</FieldLabel><Input id={`${viewId}-file`} type="file" accept=".csv,text/csv" disabled={pending} onChange={async event => {
      const file = event.target.files?.[0]; setImported(null)
      if (!file) return
      try { if (file.size > 1_000_000) throw new Error("Use a CSV smaller than 1 MB."); const parsed = parseDataTableCsv(await file.text()); setColumns(parsed.columns); setImported({ filename: file.name, rows: parsed.rows }) }
      catch (error) { onError(error instanceof Error ? error.message : "Unable to read CSV.") }
    }} />{imported && <p className="text-muted-foreground text-xs">{imported.rows.length} rows · {columns.map(column => column.label).join(", ")}. All imported columns are editable text. The original file stays unchanged.</p>}</Field>}
    {(source === "new" || source === "import") && <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />I approve this workspace’s existing member audience for this table.</label>}
    <p className="text-muted-foreground text-xs">Workspace owners, admins and staff can edit; other authorized workspace members can read. Tables are private. Views share source records, and hiding a column does not change access.</p>
    <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create saved view"}</Button>
  </form>
}
