import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const close = "select public.fixture_closure('request',600,0)"
const save = "select public.save_workspace_objective_plan_v2(public.fixture_form_id(1),public.fixture_objective_plan())"
const authenticated = (sql: string) => `set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; set local role authenticated; ${sql}`
const effect = (sql: string) => query(`begin; ${authenticated(sql)}; commit`)

describe.skipIf(!databaseUrl)("legacy canonical objective closure", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_objectives(); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const client of clients) client.kill("SIGTERM") })
  it("serializes the actual manual plan RPC before closure", async () => {
    const release = await hold(authenticated(save))
    const closing = await queued(close)
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.workspace_objective_plans; select count(*) from public.workspace_objective_plan_steps")).stdout.trim()).toBe("1\n1")
  })
  it("denies manual plan creation atomically during and after closure", async () => {
    // A real editor already holds its draft before shutdown. Reading fixture
    // rows during the lock is now correctly filtered by private read admission.
    const draft = (await query("select public.fixture_objective_plan()")).stdout.trim()
    const pendingSave = `select public.save_workspace_objective_plan_v2(public.fixture_form_id(1),'${draft.replaceAll("'", "''")}'::jsonb)`
    const release = await hold(close)
    expect((await effect(pendingSave)).stderr).toContain("Organization is changing; retry document edit")
    await release()
    expect((await effect(pendingSave)).stderr).toContain("Organization unavailable")
    expect((await query("select count(*) from public.workspace_objective_plans; select count(*) from public.workspace_objective_plan_steps")).stdout.trim()).toBe("0\n0")
  })
  it("preserves plan revision winners and denies closed step updates", async () => {
    const saved = await effect(save)
    expect(saved.code, saved.stderr).toBe(0)
    const stale = await effect(save)
    expect(stale.stderr).toContain("Plan changed")
    expect((await query(close)).code).toBe(0)
    const changed = await query("update public.organization_workspace_objective_steps set title='Forbidden' where id=public.fixture_form_id(2621)")
    expect(changed.stderr).toContain("Organization unavailable")
    expect((await query("select title from public.organization_workspace_objective_steps where id=public.fixture_form_id(2621)")).stdout.trim()).toBe("Step")
  })
  it("preserves authored content in both organizations when a separate login is deleted", async () => {
    expect((await effect(save)).code).toBe(0)
    expect((await query(close)).code).toBe(0)
    const cleanup = await query("delete from auth.users where id=public.fixture_form_id(13)")
    expect(cleanup.code, cleanup.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_workspace_objectives where created_by is null and updated_by is null; select count(*) from public.organization_workspace_objective_groups where created_by is null; select count(*) from public.organization_workspace_objective_links where created_by is null; select count(*) from public.organization_workspace_objective_activity where actor_id is null; select count(*) from public.organization_workspace_objective_assignees; select count(*) from public.workspace_objective_plans")).stdout.trim()).toBe("2\n2\n2\n2\n0\n1")
  })
  it("rejects parent-owner mismatch and canonical reparenting", async () => {
    const mismatch = await query("insert into public.organization_workspace_objective_steps(org_id,objective_id,step_order,step_type,title) values(public.fixture_form_id(2),public.fixture_form_id(2611),9,'custom','Foreign')")
    expect(mismatch.stderr).toContain("Objective owner mismatch")
    expect((await query("update public.organization_workspace_objectives set org_id=public.fixture_form_id(2) where id=public.fixture_form_id(2611)")).stderr).toContain("Objective scope cannot change")
  })
  it("rejects parent cascades during closure without touching another organization", async () => {
    expect((await query(close)).code).toBe(0)
    expect((await query("delete from public.organization_workspace_objectives where id=public.fixture_form_id(2611)")).stderr).toContain("Organization unavailable")
    const other = await query("update public.organization_workspace_objectives set title='Allowed' where id=public.fixture_form_id(2612)")
    expect(other.code, other.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_workspace_objective_steps where objective_id=public.fixture_form_id(2611)")).stdout.trim()).toBe("1")
  })
  it("permits explicit work after cancel without restoring publication", async () => {
    expect((await query(close)).code).toBe(0)
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    const saved = await effect(save)
    expect(saved.code, saved.stderr).toBe(0)
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
})
