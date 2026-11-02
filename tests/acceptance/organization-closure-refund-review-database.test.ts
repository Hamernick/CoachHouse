import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const close = "select public.fixture_closure('request',600,0)"
const review = "select public.review_organization_closure_refunds(public.fixture_form_id(1),public.fixture_form_id(1))"
const service = (sql: string) => query(`begin; set local role service_role; ${sql}; commit`)
const read = async () => {
  const result = await service(review)
  expect(result.code, result.stderr).toBe(0)
  return JSON.parse(result.stdout.trim())
}

describe.skipIf(!databaseUrl)("closure refund reconciliation without dispatch", () => {
  beforeEach(async () => {
    const result = await query("begin; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_refund_review(); commit")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const client of clients) client.kill("SIGTERM") })
  it("requires current closure and owner identity without lending financial or response access", async () => {
    expect((await service(review)).stderr).toContain("Organization is not closing")
    expect((await query(close)).code).toBe(0)
    expect((await service("select public.review_organization_closure_refunds(public.fixture_form_id(1),public.fixture_form_id(2))")).stderr).toContain("Organization owner required")
    expect((await query(`set role authenticated; ${review}`)).stderr).toContain("permission denied")
    expect((await query("select has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE')")).stdout.trim()).toBe("f")
  })
  it("reports exact original payment basis and orphaned purchased lots without granting dispatch", async () => {
    expect((await query(close)).code).toBe(0)
    const result = await read()
    expect(result).toMatchObject({ unsettledRuns: 0, unreconciledPurchases: 0, unboundPurchasedLots: 1, paidOrderCount: 1, truncated: false, dispatchAllowed: false })
    expect(result.orders[0]).toMatchObject({ purchasedCredits: 20000, consumedCredits: 0, unusedCredits: 20000, paidMinorUnits: 1000, unusedMinorUnitsNumerator: "20000000", unusedMinorUnitsDenominator: 20000, exactUnusedMinorUnits: 1000, reviewReason: null })
    expect((await read()).orders).toEqual(result.orders)
    expect((await query("select count(*) from public.ai_credit_payment_adjustments")).stdout.trim()).toBe("0")
  })
  it.each([[10020, 999, null], [10001, null, "fractional_minor_unit"]])("uses actual settled purchased consumption: %s", async (spent, exact, reason) => {
    const settlement = await query(`select public.fixture_refund_spend(${spent})`)
    expect(settlement.code, settlement.stderr).toBe(0)
    expect((await query(close)).code).toBe(0)
    const result = await read()
    expect(result.orders[0]).toMatchObject({ consumedCredits: Number(spent) - 10000, exactUnusedMinorUnits: exact, reviewReason: reason })
  })
  it("retains unresolved run and expired checkout liabilities", async () => {
    expect((await query("select public.fixture_ai_reserve(); select public.fixture_billing_purchase(2512); update public.ai_credit_purchase_orders set expires_at=now()-interval '1 day' where id=public.fixture_form_id(2512)")).code).toBe(0)
    expect((await query(close)).code).toBe(0)
    expect(await read()).toMatchObject({ unsettledRuns: 1, unreconciledPurchases: 1, dispatchAllowed: false })
  })
  it("reports existing payment adjustments as review rather than silently refunding twice", async () => {
    const adjusted = await service("select public.record_ai_credit_payment_restriction(public.fixture_form_id(2511),'pi_refund_fixture','test','refund','re_fixture','succeeded',200,'usd','refund-fixture-event',100)")
    expect(adjusted.code, adjusted.stderr).toBe(0)
    expect((await query(close)).code).toBe(0)
    expect((await read()).orders[0]).toMatchObject({ confirmedRefundMinorUnits: 200, paymentIssue: "partially_refunded", reviewReason: "payment_adjustment" })
  })
  it("rejects stale isolation and retries busy accounting without lock inversion", async () => {
    expect((await query(close)).code).toBe(0)
    expect((await query(`begin isolation level repeatable read; ${review}; commit`)).stderr).toContain("READ COMMITTED")
    const release = await hold("select * from public.ai_credit_policy for update")
    expect((await service(review)).stderr).toContain("Accounting is changing")
    await release()
    expect((await read()).dispatchAllowed).toBe(false)
  })
  it("rechecks cancellation after waiting on the organization and retains financial review after expiry", async () => {
    expect((await query(close)).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    const waiting = await queued(review)
    await release()
    expect((await waiting.result).stderr).toContain("Organization is not closing")
    expect((await query("select public.fixture_closure('request',602,2); update public.organization_closures set requested_at=now()-interval '31 days',export_until=now()-interval '31 days'+interval '720 hours' where org_id=public.fixture_form_id(1)")).code).toBe(0)
    expect(await read()).toMatchObject({ cancelWindowOpen: false, dispatchAllowed: false })
  })
})
