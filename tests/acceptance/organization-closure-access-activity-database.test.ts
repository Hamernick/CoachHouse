import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["settings update", "update public.organization_access_settings set admins_can_invite=false where org_id=public.fixture_form_id(1)"],
  ["settings delete", "delete from public.organization_access_settings where org_id=public.fixture_form_id(1)"],
  ["settings upsert", "insert into public.organization_access_settings(org_id,admins_can_invite) values(public.fixture_form_id(1),false) on conflict(org_id) do update set admins_can_invite=false"],
  ["membership insert", "insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(6),'staff')"],
  ["membership update", "update public.organization_memberships set role='admin' where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13)"],
  ["membership upsert", "insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(13),'admin') on conflict(org_id,member_id) do update set role=excluded.role"],
  ["invite insert", "insert into public.organization_invites(id,org_id,email,token,expires_at) values(public.fixture_form_id(2091),public.fixture_form_id(1),'synthetic-new@example.org','synthetic-new-invite',now()+interval '1 day')"],
  ["request insert", "insert into public.organization_access_requests(org_id,invitee_user_id,invitee_email,expires_at) values(public.fixture_form_id(1),public.fixture_form_id(6),'synthetic-new@example.org',now()+interval '1 day')"],
  ["activity insert", "insert into public.organization_project_activity_events(org_id,entity_type,entity_id,event_type,title) values(public.fixture_form_id(1),'project',public.fixture_form_id(2031),'updated','New')"],
  ["activity update", "update public.organization_project_activity_events set title='Changed' where id=public.fixture_form_id(2021)"],
  ["activity delete", "delete from public.organization_project_activity_events where id=public.fixture_form_id(2021)"],
  ["activity upsert", "insert into public.organization_project_activity_events select * from public.organization_project_activity_events where id=public.fixture_form_id(2021) on conflict(id) do update set title=excluded.title"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const stateSql = "select jsonb_build_object('settings',(select jsonb_agg(to_jsonb(s) order by org_id) from public.organization_access_settings s),'memberships',(select jsonb_agg(to_jsonb(m) order by org_id,member_id) from public.organization_memberships m),'activity',(select jsonb_agg(to_jsonb(a) order by id) from public.organization_project_activity_events a))::text"
let baseline: string

// Explicit disposable fixture; independent sessions mutate sequentially.
describe.skipIf(!databaseUrl)("closure access and activity serialization", () => {
  beforeEach(async () => {
    const reset = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_access_activity(); commit")
    expect(reset.code, reset.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each(direct)("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(direct)("rejects %s during and after closure", async (_name, sql) => {
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
  it.each([
    ["settings", "select 1 from public.organization_access_settings where org_id=public.fixture_form_id(1) for update", direct[0][1]],
    ["membership", "select 1 from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13) for update", direct[4][1]],
    ["activity", "select 1 from public.organization_project_activity_events where id=public.fixture_form_id(2021) for update", direct[9][1]],
  ])("rechecks queued %s edits after a tuple wait", async (_name, lock, sql) => {
    const release = await hold(lock)
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(["organization_invites", "organization_access_requests"])("retries closure safely when %s is already locked", async table => {
    const release = await hold(`select 1 from public.${table} where org_id=public.fixture_form_id(1) for update`)
    const result = await query("select public.fixture_closure('request',600,0)")
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization access is changing; retry closure")
    expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_invites where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("0\n1")
    await release()
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
  })
  it("rejects acceptance after waiting for closure's request revocation", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const accepting = await queued(`begin; ${privileged("update public.organization_access_requests set status='accepted' where id=public.fixture_form_id(2011)")}; commit`)
    await release()
    const result = await accepting.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select status from public.organization_access_requests where id=public.fixture_form_id(2011)")).stdout.trim()).toBe("revoked")
  })
  it.each([
    ["Drive revocation", "select public.fixture_drive_disconnect()"],
    ["Drive deletion", "delete from public.google_drive_connections where id=public.fixture_form_id(1110)"],
    ["separate account deletion", "delete from auth.users where id=public.fixture_form_id(13)"],
  ])("retains %s audit effects while closure owns the organization", async (_name, cleanup) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(cleanup)
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_external_documents; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2)); select count(*) from public.organization_closure_activity_admissions")).stdout.trim()).toBe("2\n2\n0")
    expect(Number((await query("select count(*) from public.organization_project_activity_events where entity_type='file'")).stdout.trim())).toBeGreaterThan(4)
  })
  it("keeps explicit revocation available and never restores it on cancel", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const revoked = await effect("delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13)")
    expect(revoked.code, revoked.stderr).toBe(0)
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await query("select count(*) from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(13); select count(*) from public.organization_invites where org_id=public.fixture_form_id(1); select status from public.organization_access_requests where id=public.fixture_form_id(2011); select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("0\n0\nrevoked\nprivate")
    expect((await effect(direct[0][1])).code).toBe(0)
  })
  it("preserves other organizations and rejects mixed batches atomically", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const other = "update public.organization_access_settings set admins_can_invite=false where org_id=public.fixture_form_id(2)"
    expect((await effect(other)).code).toBe(0)
    const mixed = await effect(`update public.organization_access_settings set admins_can_invite=true where org_id=public.fixture_form_id(2); ${direct[9][1]}`)
    expect(mixed.code).not.toBe(0)
    expect((await query("select admins_can_invite from public.organization_access_settings where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("f")
  })
  it.each(["repeatable read", "serializable"])("rejects %s admission", async isolation => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(direct[0][1])}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
