import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["history", "insert into public.organization_core_document_versions(org_id,section_id,content,actor_id) values(public.fixture_form_id(1),'mission','{\"content\":\"Recorded\"}',public.fixture_form_id(13))"],
  ["session", "update public.organization_core_document_sessions set section_content='Changed' where org_id=public.fixture_form_id(1)"],
  ["presence", "update public.organization_core_document_presence set mode='editing' where org_id=public.fixture_form_id(1)"],
] as const
const commits = [
  ["session-only commit", "select public.fixture_core_commit()"],
  ["profile/history/session commit", "select public.fixture_core_commit(true)"],
  ["initialization", "select public.fixture_core_initialize()"],
] as const
const tuples = [
  ["session", "organization_core_document_sessions", direct[1][1]],
  ["presence", "organization_core_document_presence", direct[2][1]],
  ["history deletion", "organization_core_document_versions", "delete from public.organization_core_document_versions where org_id=public.fixture_form_id(1)"],
] as const
const privileged = (sql: string) => `set local role service_role; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effectQuery = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const tables = ["organization_core_document_versions", "organization_core_document_sessions", "organization_core_document_presence"]
const stateSql = `select jsonb_build_object('profile',(select profile from public.organizations where user_id=public.fixture_form_id(1)),${tables.map(table => `'${table}',(select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.${table} t where org_id=public.fixture_form_id(1))`).join(",")})::text`
let baseline: string

// Provision organization-closure-core-documents-fixture.sql. Mutate fixtures sequentially.
describe.skipIf(!databaseUrl)("closure core-document serialization", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_core_documents(); commit")
    expect(result.code, result.stderr).toBe(0)
    const state = await query(stateSql)
    expect(state.code, state.stderr).toBe(0)
    baseline = state.stdout.trim()
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  it.each([...direct, ...commits])("finishes admitted %s before closure", async (_name, sql) => {
    const release = await hold(privileged(sql))
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it.each(direct)("denies busy and committed closure for %s without partial effects", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const busy = await effectQuery(sql)
    expect(busy.code).not.toBe(0)
    expect(busy.stderr).toContain("Organization is changing; retry document edit")
    await release()
    const closed = await effectQuery(sql)
    expect(closed.code).not.toBe(0)
    expect(closed.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(commits)("rejects %s after its organization wait without partial effects", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it.each(tuples)("rechecks queued %s after a tuple wait", async (_name, table, sql) => {
    const release = await hold(`select 1 from public.${table} where org_id=public.fixture_form_id(1) for update`)
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rejects reverse session/org lock admission while the real commit waits", async () => {
    const release = await hold("select 1 from public.organization_core_document_sessions where org_id=public.fixture_form_id(1) for update")
    const writing = await queued(`begin; ${privileged("select public.fixture_core_commit()")}; commit`)
    await release("do $$ begin begin update public.organization_core_document_sessions set section_content='Must retry' where org_id=public.fixture_form_id(1); raise exception 'Reverse admission accepted'; exception when serialization_failure then if sqlerrm<>'Organization is changing; retry document edit' then raise; end if; end; end $$")
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
    expect((await query("select version,section_content from public.organization_core_document_sessions where org_id=public.fixture_form_id(1); select profile#>>'{roadmap,sections,0,content}' from public.organizations where user_id=public.fixture_form_id(1)")).stdout.trim()).toBe("1|Edited\nOriginal")
  })
  it("keeps one profile/session winner and one history entry for concurrent same-revision saves", async () => {
    const results = await Promise.all([effectQuery("select public.fixture_core_commit(true)"), effectQuery("select public.fixture_core_commit(true)")])
    for (const result of results) expect(result.code, result.stderr).toBe(0)
    expect(results.map(result => result.stdout.trim()).sort()).toEqual(["f", "t"])
    expect((await query("select count(*) from public.organization_core_document_versions where org_id=public.fixture_form_id(1); select version from public.organization_core_document_sessions where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("2\n1")
  })
  it("allows presence departure while closure holds the organization", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await effectQuery("delete from public.organization_core_document_presence where org_id=public.fixture_form_id(1)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select count(*) from public.organization_core_document_presence where org_id=public.fixture_form_id(1); select count(*) from public.organization_core_document_versions where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("0\n1")
  })
  it("retains history and clears attribution/presence after actual account cleanup waits", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // The existing external-reference activity FK waits; core cleanup must still finish.
    const removing = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await removing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*),bool_and(actor_id is null and content->>'content'='Original') from public.organization_core_document_versions; select count(*) from public.organization_core_document_presence; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2|t\n0\n2")
  })
  it("preserves other-organization session writes during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await effectQuery("update public.organization_core_document_sessions set section_content='Other saved' where org_id=public.fixture_form_id(2)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select section_content from public.organization_core_document_sessions where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("Other saved")
  })
  it("rolls back a mixed-organization batch when a closing session write rejects", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await effectQuery("update public.organization_core_document_sessions set section_content='Must rollback' where org_id=public.fixture_form_id(2); select public.fixture_core_commit(true)")
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select section_content from public.organization_core_document_sessions where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("Original")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("allows explicit save retry after cancellation without republishing", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    const writing = await queued(`begin; ${privileged("select public.fixture_core_commit(true)")}; commit`)
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10); select profile#>>'{roadmap,sections,0,content}' from public.organizations where user_id=public.fixture_form_id(1)")).stdout.trim()).toBe("private\nEdited")
  })
  it.each(["repeatable read", "serializable"])("rejects %s session admission", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${privileged("select public.fixture_core_commit()")}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
