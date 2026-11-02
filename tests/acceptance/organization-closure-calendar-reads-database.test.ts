import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const service = (sql: string) => `begin; set local role service_role; ${sql}; commit`
const feed = (type: string, org = 1) => `select public.read_roadmap_calendar_feed('synthetic-${type}-${org}','${type}')`
const member = (sql: string, actor = 5) => `begin; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-${String(actor).padStart(12, "0")}'; ${sql}; commit`

describe.skipIf(!databaseUrl)("calendar closure read boundaries", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_calendar(); insert into public.organization_memberships(org_id,member_id,role) values(public.fixture_form_id(1),public.fixture_form_id(5),'board') on conflict do nothing; update public.organizations set is_public_roadmap=true where user_id=public.fixture_form_id(1); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it.each(["public", "internal"])("finishes admitted %s feed before closure", async (type) => {
    const release = await hold(`set local role service_role; ${feed(type)}`)
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    expect((await closing.result).stdout.trim()).toBe("closing")
    expect((await query(service(feed(type)))).stdout.trim()).toBe("")
  })
  it.each(["public", "internal"])("denies busy/closed %s feed and keeps other org", async (type) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    expect((await query(service(feed(type)))).stdout.trim()).toBe("")
    const other = await query(service(feed(type, 2)))
    expect(other.code, other.stderr).toBe(0)
    expect(JSON.parse(other.stdout)[0].title).toContain("event")
    await release()
    expect((await query(service(feed(type)))).stdout.trim()).toBe("")
  })
  it.each(["public", "internal"])("rechecks revoked %s token after tuple wait", async (type) => {
    const release = await hold(`delete from public.roadmap_calendar_${type}_feeds where org_id=public.fixture_form_id(1)`)
    const reading = await queued(service(feed(type)))
    await release()
    const result = await reading.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("")
  })
  it("locks authorized private export before closure and denies after membership revocation", async () => {
    const release = await hold("set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005'; select title from public.roadmap_calendar_internal_events")
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    expect((await closing.result).stdout.trim()).toBe("closing")
    expect((await query(member("select title from public.roadmap_calendar_internal_events"))).stdout.trim()).toBe("Internal event")
    expect((await query("delete from public.organization_memberships where org_id=public.fixture_form_id(1) and member_id=public.fixture_form_id(5)")).code).toBe(0)
    expect((await query(member("select title from public.roadmap_calendar_internal_events"))).stdout.trim()).toBe("")
  })
  it("uses wall-clock expiry inside an already-open export transaction", async () => {
    expect((await query("select public.fixture_closure('request',600,0); update public.organization_closures set requested_at=now()-interval '720 hours'+interval '250 milliseconds',export_until=now()+interval '250 milliseconds' where org_id=public.fixture_form_id(1)")).code).toBe(0)
    const result = await query(member("select count(*) from public.roadmap_calendar_internal_events; select pg_sleep(0.3); select count(*) from public.roadmap_calendar_internal_events"))
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("1\n\n0")
  })
  it("cancel restores private rights but neither public event publication nor feed URLs", async () => {
    expect((await query("select public.fixture_closure('request',600,0); select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await query("set role anon; select count(*) from public.roadmap_calendar_public_events")).stdout.trim()).toBe("0")
    expect((await query(member("select count(*) from public.roadmap_calendar_public_events"))).stdout.trim()).toBe("1")
    expect((await query(service(feed("public")))).stdout.trim()).toBe("")
    expect((await query(service(feed("internal")))).stdout.trim()).toBe("")
  })
  it.each(["repeatable read", "serializable"])("denies fixed snapshot %s feed and direct read", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; set local role service_role; ${feed("public")}; set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000005'; select count(*) from public.roadmap_calendar_internal_events; commit`)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("0")
  })
})
