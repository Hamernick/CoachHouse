import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const direct = [
  ["update", "update public.organization_brand_kits set identity=jsonb_set(identity,'{draft,name}','\"Changed\"') where org_id=public.fixture_form_id(1)"],
  ["delete", "delete from public.organization_brand_kits where org_id=public.fixture_form_id(1)"],
  ["upsert", "insert into public.organization_brand_kits select * from public.organization_brand_kits where org_id=public.fixture_form_id(1) on conflict(org_id) do update set identity=excluded.identity"],
] as const
const privileged = (sql: string, role = "service_role") => `set local role ${role}; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${sql}`
const effectQuery = (sql: string, role?: string) => query(`begin; ${privileged(sql, role)}; commit`)
const save = privileged("select public.fixture_brand_save()", "authenticated")
const stateSql = "select jsonb_build_object('profile',(select profile from public.organizations where user_id=public.fixture_form_id(1)),'kit',(select to_jsonb(k) from public.organization_brand_kits k where org_id=public.fixture_form_id(1)))::text"
let baseline: string

// Provision organization-closure-brand-kits-fixture.sql; fixture mutation is sequential.
describe.skipIf(!databaseUrl)("closure private brand-kit serialization", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_brand_kits(); commit")
    expect(result.code, result.stderr).toBe(0)
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
  it("finishes an admitted authenticated profile/kit save before closure", async () => {
    const release = await hold(save)
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    expect((await closing.result).code).toBe(0)
    expect((await query("select profile->>'name' from public.organizations where user_id=public.fixture_form_id(1); select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("Edited\nEdited")
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
  it.each(direct.slice(0, 2))("rechecks queued %s after a kit tuple wait", async (_name, sql) => {
    const release = await hold("select 1 from public.organization_brand_kits where org_id=public.fixture_form_id(1) for update")
    const writing = await queued(`begin; ${privileged(sql)}; commit`)
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rejects the authenticated atomic save after its organization wait", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(`begin; ${save}; commit`)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("rejects reverse kit/org admission while the atomic save waits", async () => {
    const release = await hold("select 1 from public.organization_brand_kits where org_id=public.fixture_form_id(1) for update")
    const writing = await queued(`begin; ${save}; commit`)
    await release("do $$ begin begin update public.organization_brand_kits set identity='{}' where org_id=public.fixture_form_id(1); raise exception 'Reverse admission accepted'; exception when serialization_failure then if sqlerrm<>'Organization is changing; retry document edit' then raise; end if; end; end $$")
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
  })
  it("keeps one winner for concurrent same-revision profile/kit saves", async () => {
    const results = await Promise.all([query(`begin; ${save}; commit`), query(`begin; ${save}; commit`)])
    expect(results.filter(result => result.code === 0)).toHaveLength(1)
    expect(results.find(result => result.code !== 0)?.stderr).toMatch(/This (organization|brand kit) was updated elsewhere/)
    expect((await query("select profile->>'name' from public.organizations where user_id=public.fixture_form_id(1); select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("Edited\nEdited")
  })
  it("preserves drafts after separate account cleanup waits behind closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    // The inherited external-reference activity FK can wait before exact kit cleanup.
    const removing = await queued("delete from auth.users where id=public.fixture_form_id(13)")
    await release()
    const result = await removing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*),bool_and(updated_by is null and identity#>>'{draft,name}'='Original') from public.organization_brand_kits; select count(*) from public.organizations where user_id in(public.fixture_form_id(1),public.fixture_form_id(2))")).stdout.trim()).toBe("2|t\n2")
  })
  it("preserves other-organization kit writes during closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await effectQuery("update public.organization_brand_kits set identity='{}' where org_id=public.fixture_form_id(2)")
    expect(result.code, result.stderr).toBe(0)
    await release()
    expect((await query("select identity from public.organization_brand_kits where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("{}")
  })
  it("rolls back a mixed-organization batch when the closing kit rejects", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await effectQuery(`update public.organization_brand_kits set identity='{}' where org_id=public.fixture_form_id(2); ${direct[0][1]}`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(2)")).stdout.trim()).toBe("Original")
    expect((await query(stateSql)).stdout.trim()).toBe(baseline)
  })
  it("allows explicit save retry after cancellation without republishing", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    const writing = await queued(`begin; ${save}; commit`)
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10); select identity#>>'{draft,name}' from public.organization_brand_kits where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("private\nEdited")
  })
  it.each(["repeatable read", "serializable"])("rejects %s kit admission", async isolation => {
    const result = await query(`begin isolation level ${isolation}; ${privileged(direct[0][1])}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
