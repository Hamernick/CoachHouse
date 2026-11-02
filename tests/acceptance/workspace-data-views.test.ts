import { spawn } from "node:child_process"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { dataViewCommandSchema, dataViewPageSchema } from "@/features/workspace-data-views/lib/schema"
import { parseDataCell, parseDataTableCsv } from "@/features/workspace-data-views/lib/import"
import { projectParticlePublicContent } from "@/features/workspace-particles/lib/particle-public-content"
import { buildParticlePreset, PARTICLE_PRESETS, DEFAULT_PRESET_FIELDS } from "@/features/workspace-particles/lib/particle-presets"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const column = (type: "text" | "number" | "boolean" | "date" | "select" = "text") => ({ key: "name", label: "Name", type, writable: true, options: type === "select" ? ["Yes", "No"] : [] })
const target = { organizationId: id(1), viewId: id(2001) }
const create = (request = 2100) => ({ ...target, action: "create_view", requestId: id(request), name: "People", source: {
  kind: "new_table", columns: [column(), { ...column("number"), key: "score", label: "Score" }], rows: [{ name: "First", score: 10 }, { name: "Second", score: 2 }],
  provenance: { kind: "csv_copy", filename: "people.csv", rowCount: 2 }, audienceConfirmed: true,
} })
const read = { ...target, action: "read", page: 0 }
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
const auth = (actor = 1) => `set role authenticated; set request.jwt.claim.sub='${id(actor)}';`
const call = (command: unknown) => `select public.workspace_data_view_command(${quote(command)})`

describe("saved source-backed view contracts", () => {
  it("imports quoted CSV as an explicit text copy without evaluating formulas", () => {
    const parsed = parseDataTableCsv('Name,Note\r\n"A, B","line one\nline two"\r\n=SUM(A1),"escaped ""quote"""')
    expect(parsed.rows).toEqual([{ column_1: "A, B", column_2: "line one\nline two" }, { column_1: "=SUM(A1)", column_2: 'escaped "quote"' }])
    expect(parsed.columns.every(item => item.type === "text" && item.writable)).toBe(true)
  })
  it.each(['Name,Note\na', 'Name\n"unclosed', 'Name\n"closed"x', ',Empty\na,b', `Name\n${"x".repeat(4001)}`])("rejects invalid CSV atomically: %s", text => {
    expect(() => parseDataTableCsv(text)).toThrow()
  })
  it("validates declared scalar types and rejects impossible dates, nonfinite numbers and undeclared options", () => {
    expect(parseDataCell(column("number"), "2.5")).toBe(2.5)
    expect(parseDataCell(column("boolean"), "false")).toBe(false)
    expect(parseDataCell(column("date"), "2026-11-02")).toBe("2026-11-02")
    expect(() => parseDataCell(column("date"), "2026-02-31")).toThrow()
    expect(() => parseDataCell(column("number"), "Infinity")).toThrow()
    expect(() => parseDataCell(column("select"), "Maybe")).toThrow()
  })
  it("rejects copied audience assumptions, unknown sources, source actor spoofing and SQL-shaped queries", () => {
    expect(dataViewCommandSchema.safeParse(create()).success).toBe(true)
    for (const mutation of [
      { ...create(), source: { ...create().source, audienceConfirmed: false } },
      { ...create(), source: { kind: "responses", tableId: id(1) } },
      { ...read, actorId: id(2) }, { ...read, sql: "select * from responses" },
      { ...read, page: -1 },
    ]) expect(dataViewCommandSchema.safeParse(mutation).success).toBe(false)
  })
  it("creates a reference-only Particle with no copied rows", () => {
    const preset = PARTICLE_PRESETS.find(item => item.id === "data_view")!
    const particle = buildParticlePreset(preset, { id: id(2001), workspaceId: id(1), now: "2026-11-02T00:00:00.000Z", title: "People", description: "", fields: DEFAULT_PRESET_FIELDS })
    expect(particle.type === "activity" && particle.data.widget).toEqual({ kind: "data_view", viewId: id(2001) })
    expect(projectParticlePublicContent(particle).ok).toBe(false)
  })
})

const db = createClosureDatabaseHarness(spawn)
async function execute(command: unknown, actor = 1) {
  const result = await db.query(`${auth(actor)} ${call(command)};`)
  expect(result.code, result.stderr).toBe(0)
  return JSON.parse(result.stdout.trim())
}
async function denied(command: unknown, actor = 1, message?: string) {
  const result = await db.query(`${auth(actor)} ${call(command)};`)
  expect(result.code).not.toBe(0)
  if (message) expect(result.stderr).toContain(message)
}

describe.skipIf(!databaseUrl)("saved-view actual SQL and independent sessions", () => {
  beforeEach(async () => {
    const result = await db.query("select public.fixture_data_views();")
    expect(result.code, result.stderr).toBe(0)
  })
  afterAll(() => { for (const child of db.clients) child.kill() })
  it("persists typed imported rows once and shares edits across independently configured views", async () => {
    const receipt = await execute(create())
    expect(await execute(create())).toEqual(receipt)
    let page = dataViewPageSchema.parse(await execute(read))
    expect(page.total).toBe(2); expect(page.provenance).toMatchObject({ kind: "csv_copy", rowCount: 2 })
    const second = { ...target, viewId: id(2002) }
    await execute({ ...create(2101), ...second, source: { kind: "table", tableId: page.view!.tableId } })
    const config = { columns: ["name", "score"], filter: null, sort: { column: "score", direction: "asc" } }
    await execute({ ...target, action: "save_view", requestId: id(2102), revision: 1, config })
    page = dataViewPageSchema.parse(await execute(read))
    expect(page.view?.revision).toBe(2); expect(page.rows.map(row => row.values.score)).toEqual([2, 10])
    const edit = { ...target, action: "edit_cell", requestId: id(2103), rowId: page.rows[0].id, revision: page.rows[0].revision, column: "name", value: "Updated" }
    await execute(edit); await execute(edit)
    const other = dataViewPageSchema.parse(await execute({ ...read, ...second }))
    expect(other.view?.revision).toBe(1)
    expect(other.rows.find(row => row.id === edit.rowId)?.values.name).toBe("Updated")
    expect(other.rows.find(row => row.id === edit.rowId)?.revision).toBe("2")
    await denied({ ...edit, requestId: id(2104), value: "Lost update" }, 1, "Row changed")
    await denied({ ...edit, value: "Reused receipt" }, 1, "Request identity reused")
    await denied({ ...target, action: "save_view", requestId: id(2105), revision: 1, config }, 1, "View changed")
    await denied({ ...edit, requestId: id(2106), column: "org_id", value: id(2) }, 1, "Field is read only")
    await denied({ ...edit, requestId: id(2107), column: "score", value: "bad" }, 1, "Invalid cell")
  })
  it("keeps query counts, bounded pages and tie ordering consistent with canonical rows", async () => {
    const command = create(); command.source.rows = Array.from({ length: 57 }, (_, index) => ({ name: `Row ${index}`, score: index % 2 }))
    command.source.provenance.rowCount = 57
    await execute(command)
    const first = dataViewPageSchema.parse(await execute(read))
    const second = dataViewPageSchema.parse(await execute({ ...read, page: 1 }))
    expect(first.total).toBe(57); expect(first.rows).toHaveLength(25); expect(second.rows).toHaveLength(25)
    expect(new Set([...first.rows, ...second.rows].map(row => row.id)).size).toBe(50)
    expect(await execute(read)).toEqual(first)
    await execute({ ...target, action: "save_view", requestId: id(2101), revision: 1, config: { columns: ["name"], filter: { column: "score", value: "1" }, sort: { column: "name", direction: "desc" } } })
    const filtered = dataViewPageSchema.parse(await execute(read))
    expect(filtered.total).toBe(28)
    const independent = await db.query("select count(*) from public.organization_data_rows where values->>'score'='1'")
    expect(Number(independent.stdout.trim())).toBe(filtered.total)
    const empty = await execute({ ...target, action: "save_view", requestId: id(2102), revision: 2, config: { ...filtered.view!.config, filter: { column: "name", value: "not present" } } })
    expect(empty.revision).toBe(3); expect(dataViewPageSchema.parse(await execute(read)).total).toBe(0)
  })
  it("uses actual workspace permissions, paywall and explicit source scope", async () => {
    await execute(create())
    await denied(read, 18, "Dataset access required")
    const members = await db.query(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(18)}','member');`)
    expect(members.code, members.stderr).toBe(0)
    expect(dataViewPageSchema.parse(await execute(read, 18)).canEdit).toBe(false)
    await denied({ ...target, action: "add_row", requestId: id(2101), values: {} }, 18, "Dataset editing required")
    const page = dataViewPageSchema.parse(await execute(read))
    await denied({ ...create(2102), organizationId: id(2), viewId: id(2002), source: { kind: "table", tableId: page.view!.tableId } }, 2, "Dataset unavailable")
    await execute({ ...create(2110), viewId: id(2003), source: { kind: "projects" } })
    await db.query(`update public.subscriptions set status='canceled' where user_id='${id(1)}'`)
    expect(dataViewPageSchema.parse(await execute(read)).canEdit).toBe(true)
    await execute({ ...target, action: "add_row", requestId: id(2111), values: { name: "Free workspace" } })
    await execute({ ...create(2112), viewId: id(2004) })
    await denied({ ...read, viewId: id(2003) }, 1, "Project source access required")
    await denied({ ...create(2113), viewId: id(2005), source: { kind: "projects" } }, 1, "Project source access required")
    const direct = await db.query(`${auth()} select * from public.organization_data_rows`)
    expect(direct.code).not.toBe(0)
  })
  it("routes existing project status edits through the canonical CAS writer and denies technical fields", async () => {
    await execute({ ...create(), source: { kind: "projects" } })
    const page = dataViewPageSchema.parse(await execute(read))
    const count = await db.query(`select count(*) from public.organization_projects where org_id='${id(1)}' and not exists(select 1 from public.fiscal_guest_submissions s where s.project_id=organization_projects.id)`)
    expect(page.total).toBe(Number(count.stdout.trim()))
    const guest = await db.query("select project_id from public.fiscal_guest_submissions limit 1")
    if (guest.stdout.trim()) {
      expect(page.rows.some(item => item.id === guest.stdout.trim())).toBe(false)
      await denied({ ...target, action: "edit_cell", requestId: id(2199), rowId: guest.stdout.trim(), revision: page.rows[0].revision, column: "status", value: "active" }, 1, "Project unavailable")
    }
    const row = page.rows.find(item => item.id === id(1401))!
    await execute({ ...target, action: "edit_cell", requestId: id(2101), rowId: row.id, revision: row.revision, column: "status", value: "active" })
    const current = dataViewPageSchema.parse(await execute(read)).rows.find(item => item.id === row.id)!
    expect(current.values.status).toBe("active"); expect(current.revision).not.toBe(row.revision)
    await denied({ ...target, action: "edit_cell", requestId: id(2102), rowId: row.id, revision: row.revision, column: "status", value: "completed" }, 1, "Project changed")
    await denied({ ...target, action: "edit_cell", requestId: id(2103), rowId: row.id, revision: current.revision, column: "title", value: "Renamed" }, 1, "Field is read only")
    const independent = await db.query(`select status from public.organization_projects where id='${row.id}'`)
    expect(independent.stdout.trim()).toBe("active")
  })
  it("rejects atomic invalid imports without leaving tables or receipts", async () => {
    const invalid = create(); invalid.source.rows[1].score = "bad" as unknown as number
    await denied(invalid, 1, "Invalid cell")
    const result = await db.query("select (select count(*) from public.organization_data_tables)+(select count(*) from public.organization_data_rows)+(select count(*) from public.organization_data_views)+(select count(*) from public.organization_data_view_receipts)")
    expect(result.stdout.trim()).toBe("0")
  })
  it("serializes duplicate import requests and preserves only one canonical dataset", async () => {
    const release = await db.hold(`${auth()} ${call(create())}`)
    await denied(create(), 1, "Request is in flight")
    await release()
    await execute(create())
    const result = await db.query("select count(*) from public.organization_data_tables")
    expect(result.stdout.trim()).toBe("1")
  })
  it("blocks closure behind admitted writes and rejects writes after closure", async () => {
    const release = await db.hold(`${auth()} ${call(create())}`)
    await db.blocked("select public.fixture_closure('request',3000,0)")
    await release()
    await db.query("select public.fixture_closure('request',3000,0)")
    await denied({ ...target, action: "add_row", requestId: id(2101), values: {} }, 1, "closure")
    const exporting = dataViewPageSchema.parse(await execute(read))
    expect(exporting.canEdit).toBe(false); expect(exporting.total).toBe(2)
    expect(dataViewPageSchema.parse(await execute({ ...read, organizationId: id(2), viewId: id(2002) }, 2)).view).toBeNull()
  })
  it("fails safely while closure owns the organization and resumes only after cancellation", async () => {
    await execute(create())
    const release = await db.hold("select public.fixture_closure('request',3000,0)")
    await denied({ ...target, action: "add_row", requestId: id(2101), values: {} }, 1, "Organization is changing")
    await release()
    await db.query("select public.fixture_closure('cancel',3001,1)")
    await execute({ ...target, action: "add_row", requestId: id(2101), values: {} })
    expect(dataViewPageSchema.parse(await execute(read)).total).toBe(3)
  })
  it("rejects SQL-side unknown fields and oversized metadata before any persistence", async () => {
    const commands = [
      { ...create(), extra: "not authorized" },
      { ...create(), source: { ...create().source, extra: "not authorized" } },
      { ...create(), source: { ...create().source, provenance: { ...create().source.provenance, raw: "private" } } },
      { ...create(), source: { ...create().source, columns: [{ ...column(), secret: "x" }] } },
      { ...create(), name: "x".repeat(1_000_001) },
    ]
    for (const command of commands) await denied(command)
    const empty = await db.query("select count(*) from public.organization_data_view_receipts")
    expect(empty.stdout.trim()).toBe("0")
    await execute(create())
    await denied({ ...target, action: "save_view", requestId: id(2101), revision: 1, config: { columns: ["name"], filter: null, sort: { column: "name", direction: "asc", raw: "sql" } } })
    const receipt = await db.query("update public.organization_data_view_receipts set result='{}'")
    expect(receipt.code).not.toBe(0); expect(receipt.stderr).toContain("immutable")
    const service = await db.query("set role service_role; update public.organization_data_rows set values='{}'")
    expect(service.code).not.toBe(0); expect(service.stderr).toContain("permission denied")
  })
  it("preserves authorized private reads only inside the fixed closure export window", async () => {
    await execute(create())
    await db.query("select public.fixture_closure('request',3000,0)")
    const current = dataViewPageSchema.parse(await execute(read))
    expect(current.canEdit).toBe(false); expect(current.total).toBe(2)
    await denied(read, 18, "Dataset access required")
    const expired = await db.query("update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z'")
    expect(expired.code, expired.stderr).toBe(0)
    await denied(read, 1, "Organization unavailable")
  })
  it("fences every new canonical store even through privileged direct writes", async () => {
    await execute(create())
    const closed = await db.query("select public.fixture_closure('request',3000,0)")
    expect(closed.code, closed.stderr).toBe(0)
    for (const sql of [
      "update public.organization_data_tables set name='Bypass'",
      "update public.organization_data_rows set values='{}'",
      "update public.organization_data_views set revision=revision+1",
      "delete from public.organization_data_view_receipts",
    ]) {
      const result = await db.query(sql)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("closure")
    }
  })
  it("joins direct privileged row edits to the same closure serialization boundary", async () => {
    await execute(create())
    const release = await db.hold("update public.organization_data_rows set revision=revision+1")
    const closing = await db.queued("select public.fixture_closure('request',3000,0)")
    await release()
    expect((await closing.result).code).toBe(0)
  })
  it("locks actual member authority through source writes and rejects a subsequent revoked actor", async () => {
    await db.query(`insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(14)}','staff') on conflict(org_id,member_id) do update set role='staff'`)
    const release = await db.hold(`${auth(14)} ${call(create())}`)
    await db.blocked(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(14)}'`)
    await release()
    await db.query(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(14)}'`)
    await denied({ ...target, action: "add_row", requestId: id(2101), values: {} }, 14, "Dataset access required")
  })
})
