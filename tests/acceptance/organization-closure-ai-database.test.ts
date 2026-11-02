import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const privileged = (sql: string) => `set local role service_role; ${sql}`
const effect = (sql: string) => query(`begin; ${privileged(sql)}; commit`)
const reserve = "select public.fixture_ai_reserve()"
const claim = "select public.fixture_ai_claim()"
const close = "select public.fixture_closure('request',600,0)"
const read = "select status||':'||coalesce(charged_credits::text,'pending')||':'||coalesce(provider_microdollars::text,'pending')||':'||provider_cost_state from public.workspace_ai_runs where id=public.fixture_form_id(1801)"

describe.skipIf(!databaseUrl)("closure AI admission and settlement", () => {
  beforeEach(async () => {
    const reset=await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_ai(); commit")
    expect(reset.code,reset.stderr).toBe(0)
  })
  afterEach(() => { for(const child of clients) child.kill("SIGTERM") })
  it.each([reserve,"select public.fixture_ai_research()"])("finishes admitted reservation before closure: %s",async sql=>{
    const release=await hold(privileged(sql))
    const closing=await queued(close)
    await release()
    const result=await closing.result
    expect(result.code,result.stderr).toBe(0)
    expect((await query("select count(*) from public.workspace_ai_runs where org_id=public.fixture_form_id(1) and cancel_requested_at is not null")).stdout.trim()).toBe("1")
  })
  it("denies new admission during and after closure without disturbing another organization",async()=>{
    const release=await hold(close)
    expect((await effect(reserve)).stderr).toContain("Organization is changing; retry document edit")
    expect((await effect("select public.fixture_ai_reserve(1802,2,2)")).code).toBe(0)
    await release()
    expect((await effect(reserve)).stderr).toContain("Organization unavailable")
    expect((await query("select count(*) from public.workspace_ai_runs where org_id=public.fixture_form_id(1); select count(*) from public.ai_credit_reservations")).stdout.trim()).toBe("0\n1")
  })
  it("cancels a claim admitted before closure",async()=>{
    expect((await effect(reserve)).code).toBe(0)
    const release=await hold(privileged(claim))
    const closing=await queued(close)
    await release()
    expect((await closing.result).code).toBe(0)
    expect((await query("select cancel_requested_at is not null from public.workspace_ai_runs where id=public.fixture_form_id(1801)")).stdout.trim()).toBe("t")
  })
  it("does not claim a run after waiting for closure cancellation",async()=>{
    expect((await effect(reserve)).code).toBe(0)
    const release=await hold(close)
    const claiming=await queued(`begin; ${privileged(claim)}; commit`)
    await release()
    const result=await claiming.result
    expect(result.code,result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("f")
  })
  it("rejects busy run locks retryably and rolls back closure withdrawal",async()=>{
    expect((await effect(reserve)).code).toBe(0)
    const release=await hold("select 1 from public.workspace_ai_runs where id=public.fixture_form_id(1801) for update")
    const result=await query(close)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("AI run is changing; retry closure")
    expect((await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("0\n0")
    await release()
    expect((await query(close)).code).toBe(0)
  })
  it("settles late measured usage once after closure without a customer charge",async()=>{
    expect((await effect(`${reserve}; ${claim}`)).code).toBe(0)
    const release=await hold(close)
    const finishing=await queued(`begin; ${privileged("select public.fixture_ai_finish()")}; commit`)
    await release()
    const result=await finishing.result
    expect(result.code,result.stderr).toBe(0)
    expect((await effect("select public.fixture_ai_finish()")).code).toBe(0)
    expect((await query(read)).stdout.trim()).toBe("canceled:0:100:measured")
    expect((await query("select count(*) from public.ai_credit_entries; select count(*) from public.workspace_ai_result_receipts")).stdout.trim()).toBe("0\n1")
  })
  it("preserves uncertain exposure until late evidence resolves it",async()=>{
    expect((await effect(`${reserve}; ${claim}`)).code).toBe(0)
    expect((await query("update public.workspace_ai_runs set created_at=now()-interval '1 day' where id=public.fixture_form_id(1801)")).code).toBe(0)
    expect((await query(close)).code).toBe(0)
    const recovered=await effect("select public.recover_workspace_ai_runs(public.fixture_form_id(1))")
    expect(recovered.code,recovered.stderr).toBe(0)
    expect((await query(read)).stdout.trim()).toBe("canceled:0:1000:unconfirmed")
    const resolved=await effect("select public.fixture_ai_finish()")
    expect(resolved.code,resolved.stderr).toBe(0)
    expect((await query(read)).stdout.trim()).toBe("canceled:0:100:measured")
  })
  it("never restarts canceled work when organization closure is canceled",async()=>{
    expect((await effect(reserve)).code).toBe(0)
    expect((await query(close)).code).toBe(0)
    expect((await query("select public.fixture_closure('cancel',601,1)")).code).toBe(0)
    expect((await effect(claim)).stdout.trim()).toBe("f")
    expect((await effect("select public.fixture_ai_finish()")).code).toBe(0)
    expect((await effect("select public.fixture_ai_reserve(1803)")).code).toBe(0)
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it("rolls back mixed-organization admission when one organization is closing",async()=>{
    expect((await query(close)).code).toBe(0)
    const result=await effect(`select public.fixture_ai_reserve(1802,2,2); ${reserve}`)
    expect(result.code).not.toBe(0)
    expect((await query("select count(*) from public.workspace_ai_runs; select count(*) from public.ai_credit_reservations")).stdout.trim()).toBe("0\n0")
  })
  it.each(["repeatable read","serializable"])("rejects %s admission",async isolation=>{
    const result=await query(`begin isolation level ${isolation}; ${privileged(reserve)}; commit`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
