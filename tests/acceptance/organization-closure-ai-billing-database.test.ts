import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const close = "select public.fixture_closure('request',600,0)"
const cancel = "select public.fixture_closure('cancel',601,1)"
const purchase = "select public.fixture_billing_purchase()"
const setup = "select public.prepare_ai_credit_refill_setup(public.fixture_billing_input())"
const attemptId = async () => (await query("select id from public.ai_credit_refill_attempts")).stdout.trim()
const charge = async () => effect(`select public.start_ai_credit_refill_charge('${await attemptId()}'::uuid)`)
const effect = (sql: string) => query(`begin; set local role service_role; ${sql}; commit`)

describe.skipIf(!databaseUrl)("AI billing closure admission and retained evidence", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_ai_billing(); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const client of clients) client.kill("SIGTERM") })

  it.each([purchase, setup])("serializes admitted billing before closure: %s", async sql => {
    const release = await hold(`set local role service_role; ${sql}`)
    const closing = await queued(close)
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    const replay = await effect(sql)
    expect(replay.stderr).toContain("Organization unavailable")
  })
  it("rejects admission during closure, preserving a different organization", async () => {
    const release = await hold(close)
    expect((await effect(purchase)).stderr).toContain("Organization is changing; retry document edit")
    expect((await effect(setup)).stderr).toContain("Organization is changing; retry document edit")
    const other = await effect("select public.fixture_billing_purchase(2512,2)")
    expect(other.code, other.stderr).toBe(0)
    await release()
    expect((await query("select count(*) from public.ai_credit_purchase_orders where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("0")
  })
  it("permanently disables consent and queued charges while retaining explicit new consent after cancel", async () => {
    const prepared = await effect("select public.fixture_billing_queue()")
    expect(prepared.code, prepared.stderr).toBe(0)
    expect((await query(close)).code).toBe(0)
    expect((await query("select status from public.ai_credit_refill_setups; select state from public.ai_credit_refill_attempts")).stdout.trim()).toBe("disabled\ncanceled")
    expect((await charge()).stdout.trim()).toBe("f")
    expect((await query(cancel)).code).toBe(0)
    expect((await charge()).stdout.trim()).toBe("f")
    expect((await effect("select public.prepare_next_ai_credit_refill('test','primary')")).stdout.trim()).toBe("")
    const forbidden = await query("update public.ai_credit_refill_setups set status='enabled'")
    expect(forbidden.stderr).toContain("Disabled refill consent cannot restart")
    const explicit = await effect("select public.prepare_ai_credit_refill_setup(public.fixture_billing_input(2502))")
    expect(explicit.code, explicit.stderr).toBe(0)
  })
  it("records an already dispatched refill once after closure without restarting consent", async () => {
    expect((await effect("select public.fixture_billing_queue()")).code).toBe(0)
    const started = await charge()
    expect(started.stdout.trim(), started.stderr).toBe("t")
    const closed = await query(close)
    expect(closed.code, closed.stderr).toBe(0)
    const id = await attemptId()
    const finished = await effect(`select public.fixture_billing_finish('${id}'::uuid); select public.fixture_billing_finish('${id}'::uuid)`)
    expect(finished.code, finished.stderr).toBe(0)
    expect((await query("select status from public.ai_credit_refill_setups; select state from public.ai_credit_refill_attempts; select count(*) from public.ai_credit_lots where operation_key='stripe-credit:test:pi_synthetic_refill'")).stdout.trim()).toBe("disabled\nsucceeded\n1")
    expect((await charge()).stdout.trim()).toBe("f")
  })
  it("retains late manual payment and idempotency evidence after closure", async () => {
    expect((await effect(purchase)).code).toBe(0)
    expect((await query(close)).code).toBe(0)
    const sql = "select public.fulfill_ai_credit_purchase(public.fixture_form_id(2511),'cs_manual','pi_manual','test',1000,'usd')"
    const first = await effect(sql)
    const retry = await effect(sql)
    expect(first.code, first.stderr).toBe(0)
    expect(retry.stdout).toBe(first.stdout)
    expect((await query("select count(*) from public.ai_credit_lots where operation_key='stripe-credit:test:pi_manual'")).stdout.trim()).toBe("1")
  })
  it("rolls back earlier shutdown effects when billing policy is busy", async () => {
    expect((await effect("select public.fixture_billing_queue()")).code).toBe(0)
    const release = await hold("select 1 from public.ai_credit_policy where id for update")
    const result = await query(close)
    expect(result.stderr).toContain("AI billing is changing; retry closure")
    expect((await query("select count(*) from public.organization_closures; select status from public.ai_credit_refill_setups; select state from public.ai_credit_refill_attempts")).stdout.trim()).toBe("0\nenabled\nqueued")
    await release()
    const retried = await query(close)
    expect(retried.code, retried.stderr).toBe(0)
  })
  it("keeps renamed implementations and lifecycle helpers inaccessible", async () => {
    const result = await query("select has_function_privilege('service_role','public.prepare_ai_credit_purchase_before_closure(uuid,uuid,uuid,text,text,text)','execute'); select has_function_privilege('service_role','public.disable_ai_billing_on_closure()','execute'); select has_function_privilege('authenticated','public.prepare_ai_credit_refill_setup(jsonb)','execute')")
    expect(result.stdout.trim()).toBe("f\nf\nf")
  })
})
