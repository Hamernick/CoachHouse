import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const writes = [
  ["program", "update public.programs set title='Edited' where id=public.fixture_form_id(1620)"],
  ["project", "update public.organization_projects set name='Edited' where id=public.fixture_form_id(1401)"],
  ["task", "update public.organization_tasks set title='Edited' where id=public.fixture_form_id(1801)"],
  ["assignment", "update public.organization_task_assignees set created_by=public.fixture_form_id(2) where id=public.fixture_form_id(1811)"],
  ["note", "update public.organization_project_notes set title='Edited' where id=public.fixture_form_id(1821)"],
  ["link", "update public.organization_project_quick_links set name='Edited' where id=public.fixture_form_id(1831)"],
  ["asset", "update public.organization_project_assets set name='Edited' where id=public.fixture_form_id(1511)"],
  ["starter", "update public.organization_workspace_starter_state set seed_version=seed_version+1 where org_id=public.fixture_form_id(1)"],
  ["import batch", "update public.task_tracker_import_batches set status='complete' where id=public.fixture_form_id(1840)"],
  ["import record", "update public.task_tracker_import_records set reason='Edited' where namespace='synthetic'"],
  ["project create", "select public.fixture_project_create()"],
  ["project save without overview", "select public.fixture_project_save()"],
  ["task creation", "select public.fixture_task_create()"],
  ["task move", "select public.fixture_task_move()"],
  ["task schedule", "select public.fixture_task_schedule()"],
  ["task deletion", "select public.delete_organization_task_transition(public.fixture_form_id(1),public.fixture_form_id(1801),public.fixture_form_id(1),public.fixture_form_id(1401))"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const tables = ["programs", "organization_projects", "organization_tasks", "organization_task_assignees", "organization_project_notes", "organization_project_quick_links", "organization_project_assets", "organization_workspace_starter_state", "task_tracker_import_batches", "task_tracker_import_records", "notifications"]
const stateSql = `select jsonb_build_array(${tables.map(table => `(select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from public.${table} r)`).join(",")})::text`
let baseline: string

describe.skipIf(!databaseUrl)("closure project task serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_project_tasks(); commit")
    expect(reset.code, reset.stderr).toBe(0)
    baseline = (await query(stateSql)).stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it.each(writes)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(writes.filter(([name]) => name !== "project create"))("rejects busy and committed closure for %s atomically", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await effect(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    const rejected = await effect(sql)
    expect(rejected.code).not.toBe(0)
    expect(rejected.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rechecks project creation after its existing organization lock waits", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(`begin; ${privileged("select public.fixture_project_create()")}; commit`)
    await release()
    const result = await writing.result
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("preserves personal program writes while another organization closes", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await query("begin; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000018'; update public.programs set title='Personal edit' where id=public.fixture_form_id(1850); commit")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select title from public.programs where id=public.fixture_form_id(1850)")).stdout.trim()).toBe("Personal edit")
  })
  it("serializes personal programs before organization creation then enforces its closure", async () => {
    const release = await hold(privileged("update public.programs set title='Personal edit' where id=public.fixture_form_id(1850)"))
    const creation = await queued("insert into public.organizations(user_id,profile,updated_at) values(public.fixture_form_id(18),'{\"name\":\"Personal org\"}',now())")
    await release()
    const result = await creation.result
    expect(result.code, result.stderr).toBe(0)
    const closing = await query("set request.jwt.claim.sub='10000000-0000-4000-8000-000000000018'; select public.organization_closure_command(public.fixture_form_id(18),public.fixture_form_id(18),'request',public.fixture_form_id(1890),0)")
    expect(closing.code, closing.stderr).toBe(0)
    expect((await effect("update public.programs set title='Denied' where id=public.fixture_form_id(1850)")).stderr).toContain("Organization unavailable")
  })
  it.each([
    ["project", "select 1 from public.organization_projects where id=public.fixture_form_id(1401) for update", "select public.fixture_task_create()"],
    ["task", "select 1 from public.organization_tasks where id=public.fixture_form_id(1801) for update", "select public.fixture_task_schedule()"],
  ])("rechecks after queued %s locks", async (_name, lock, sql) => {
    const release = await hold(lock)
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("fences the destination of an otherwise active cross-organization task move", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const moveIntoClosedOrg = "select public.update_organization_task_transition(public.fixture_form_id(2),public.fixture_form_id(1802),public.fixture_form_id(2),public.fixture_form_id(1402),public.fixture_form_id(1401),'Moved',null,'task','todo',null,null,'medium',null,null,public.fixture_form_id(13))"
    expect((await effect(moveIntoClosedOrg)).stderr).toContain("Organization is changing; retry document edit")
    await release()
    expect((await effect(moveIntoClosedOrg)).stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("retains one project revision winner", async () => {
    const revision = (await query("select updated_at from public.organization_projects where id=public.fixture_form_id(1401)")).stdout.trim()
    const results = await Promise.all([effect(`select public.fixture_project_complete('${revision}')->>'code'`), effect(`select public.fixture_project_complete('${revision}')->>'code'`)])
    expect(results.every(result => result.code === 0)).toBe(true)
    expect(results.filter(result => result.stdout.trim() === "stale")).toHaveLength(1)
  })
  it("finishes deferred recurrence and copied tasks before closure", async () => {
    expect((await effect("update public.organization_projects set recurrence='monthly' where id=public.fixture_form_id(1401)")).code).toBe(0)
    const release = await hold(privileged("select public.fixture_project_complete()"))
    const closing = await queued("select public.fixture_closure('request',600,0)")
    await release()
    expect((await closing.result).code).toBe(0)
    expect((await query("select count(*) from public.organization_projects where recurrence_occurrence=1; select count(*) from public.organization_tasks")).stdout.trim()).toBe("1\n3")
  })
  it("preserves exact account attribution cleanup and removes only its assignments", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const cleanup = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await cleanup.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_tasks where created_by is null and updated_by is null and title='Original'; select count(*) from public.organization_task_assignees; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2\n0\n2")
  })
  it("keeps other organizations writable and rolls back mixed batches", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    expect((await effect("update public.organization_tasks set title='Other' where id=public.fixture_form_id(1802)")).code).toBe(0)
    expect((await effect(`update public.organization_tasks set title='Partial' where id=public.fixture_form_id(1802); ${writes[2][1]}`)).stderr).toContain("Organization unavailable")
    expect((await query("select title from public.organization_tasks order by org_id")).stdout.trim()).toBe("Original\nOther")
  })
  it("permits explicit retry after cancel without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    expect((await effect("select public.fixture_task_create()")).stderr).toContain("Organization is changing; retry document edit")
    await release()
    expect((await effect("select public.fixture_task_create()")).code).toBe(0)
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it.each(["repeatable read", "serializable"])("rejects %s admission", async isolation => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(writes[2][1])}; commit`)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
