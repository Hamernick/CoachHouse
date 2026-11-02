import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { processOrganizationClosureRefund } from "@/features/ai-credits/server/closure-refund-payment"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
const db = createClosureDatabaseHarness(spawn)
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: (...args: unknown[]) => {
  const pending = mocks.rpc(...args)
  return Object.assign(pending, { abortSignal: () => pending })
} }) }))
const org = "public.fixture_form_id(1)", order = "public.fixture_form_id(2511)"
const call = (action: string, actor = org) => `select public.${action}_organization_closure_refund(${org},${order},${actor})`
const service = (sql: string) => db.query(`set role service_role; ${sql}`)
async function run(action: string) { const reply = await service(call(action)); expect(reply.code, reply.stderr).toBe(0); return JSON.parse(reply.stdout.trim()) }
async function setup(sql: string) { const reply = await db.query(sql); expect(reply.code, reply.stderr).toBe(0) }
describe.skipIf(!databaseUrl)("exact closure refund admission and immutable financial recovery", () => {
  beforeEach(() => setup("set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; select public.fixture_closure_refund_review()"))
  afterEach(() => { vi.unstubAllEnvs(); for (const client of db.clients) client.kill() })
  it("requires actual closure deadline, current owner and service authority", async () => {
    expect((await service(call("prepare"))).code).not.toBe(0)
    await setup("select public.fixture_closure('request',600,0)")
    expect(await run("prepare")).toMatchObject({ intent: null, reason: "cancellation_window_open", dispatchAllowed: false })
    expect((await service(call("read", "public.fixture_form_id(2)"))).code).not.toBe(0)
    expect((await db.query(`set role authenticated; ${call("read")}`)).code).not.toBe(0)
    expect((await db.query("select has_function_privilege('service_role','public.organization_closure_command(uuid,uuid,text,uuid,integer)','execute')")).stdout.trim()).toBe("f")
  })
  it("freezes actual settled consumption and original purchase basis with exact repeated preparation", async () => {
    await setup("select public.fixture_refund_spend(10020); select public.fixture_refund_mature()")
    const first = await run("prepare"), replay = await run("prepare")
    expect(first.intent).toMatchObject({ amount: 999, purchased_credits: 20000, consumed_credits: 20, state: "ready" })
    expect(replay.intent).toEqual(first.intent)
    expect((await db.query("update public.organization_closure_refunds set amount=1")).code).not.toBe(0)
    expect((await db.query("delete from public.organization_closure_refunds")).code).not.toBe(0)
    expect((await service("select * from public.organization_closure_refunds")).code).not.toBe(0)
  })
  it("keeps fractional balances unresolved without inventing rounding", async () => {
    await setup("select public.fixture_refund_spend(10001); select public.fixture_refund_mature()")
    expect(await run("prepare")).toMatchObject({ intent: null, reason: "fractional_minor_unit", dispatchAllowed: false })
  })
  it("refuses unsettled runs, unpaid purchases and unbound purchased lots", async () => {
    await setup("select public.fixture_ai_reserve(); select public.fixture_refund_mature()")
    expect(await run("prepare")).toMatchObject({ intent: null, reason: "unsettled_runs" })
    await setup("select public.fixture_closure_refund_review(); select public.fixture_billing_purchase(2512); select public.fixture_refund_mature()")
    expect(await run("prepare")).toMatchObject({ intent: null, reason: "unreconciled_purchases" })
    await setup("select public.fixture_closure_refund_review(); insert into public.ai_credit_lots(org_id,operation_key,kind,credits) values(public.fixture_form_id(1),'unbound-proof','purchased',20); select public.fixture_refund_mature()")
    expect(await run("prepare")).toMatchObject({ intent: null, reason: "unbound_purchased_lots" })
  })
  it("rechecks late adjustments before claim and never grants a second provider dispatch", async () => {
    await setup("select public.fixture_refund_mature()")
    await run("prepare")
    await setup("select public.record_ai_credit_payment_restriction(public.fixture_form_id(2511),'pi_refund_fixture','test','refund','re_external','succeeded',100,'usd','prior-refund',100)")
    expect(await run("claim")).toMatchObject({ dispatchAllowed: false, intent: { state: "ready", reason: "prior_payment_adjustment" } })
    await setup("select public.fixture_closure_refund_review(); select public.fixture_refund_mature()")
    await run("prepare")
    expect(await run("claim")).toMatchObject({ dispatchAllowed: true, intent: { state: "dispatching" } })
    expect(await run("claim")).toMatchObject({ dispatchAllowed: false, intent: { state: "dispatching" } })
  })
  it("records refund evidence atomically through the existing adjustment owner and rejects forged or regressive evidence", async () => {
    await setup("select public.fixture_refund_mature()"); await run("prepare")
    const { intent } = await run("claim")
    const record = (status: string, amount = 1000) => `select public.record_organization_closure_refund('${intent.id}','re_exact','${status}',${amount},'usd','pi_refund_fixture','test',100)`
    expect((await service(record("succeeded", 999))).code).not.toBe(0)
    expect((await service(record("succeeded"))).code).toBe(0)
    expect((await service(record("succeeded"))).code).toBe(0)
    expect((await service(record("pending"))).code).toBe(0)
    expect(await run("read")).toMatchObject({ dispatchAllowed: false, intent: { state: "succeeded", refund_id: "re_exact" } })
    expect((await db.query("select count(*) from public.ai_credit_payment_adjustments where kind='refund' and status='succeeded'")).stdout.trim()).toBe("1")
    expect((await db.query("select public.ai_credit_purchase_payment_issue(public.fixture_form_id(2511))")).stdout.trim()).toBe("refunded")
  })
  it("serializes independent claims and retries busy accounting without lock inversion", async () => {
    await setup("select public.fixture_refund_mature()"); await run("prepare")
    const release = await db.hold(call("claim"))
    expect((await service(call("claim"))).stderr).toContain("Accounting is changing")
    await release()
    expect(await run("claim")).toMatchObject({ dispatchAllowed: false })
    expect((await db.query(`begin isolation level repeatable read; ${call("prepare")}`)).stderr).toContain("READ COMMITTED")
  })
  it("runs the real backend/store/adjustment writers and reconciles a mocked Stripe lost reply without recreating", async () => {
    await setup("select public.fixture_refund_spend(10020); select public.fixture_refund_mature()")
    vi.stubEnv("WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED", "true")
    const literal = (value: unknown) => value === null ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      expect(name).toMatch(/^(read|prepare|claim|record)_organization_closure_refund$|^record_ai_credit_payment_restriction$/)
      const reply = await service(`select public.${name}(${Object.entries(args).map(([key, value]) => `${key}=>${literal(value)}`).join(",")})`)
      return { data: reply.stdout.trim() ? JSON.parse(reply.stdout.trim()) : null, error: reply.code === 0 ? null : reply.stderr }
    })
    const target = { organizationId: "10000000-0000-4000-8000-000000000001", actorId: "10000000-0000-4000-8000-000000000001", orderId: "10000000-0000-4000-8000-000000002511" }
    const refunds: Stripe.Refund[] = []
    const create = vi.fn(async (input: Stripe.RefundCreateParams) => {
      refunds.push({ id: "re_backend", payment_intent: input.payment_intent, amount: input.amount, currency: "usd", status: "succeeded", created: Math.floor(Date.now() / 1000), metadata: input.metadata } as unknown as Stripe.Refund)
      throw new Error("Synthetic lost response")
    })
    const stripe = { paymentIntents: { retrieve: vi.fn(async () => ({ id: "pi_refund_fixture", status: "succeeded", livemode: false, amount_received: 1000, currency: "usd", metadata: { kind: "ai_credit_pack", order_id: target.orderId } })) },
      refunds: { create, list: vi.fn(async () => ({ data: refunds, has_more: false })) }, disputes: { list: vi.fn(async () => ({ data: [], has_more: false })) } } as unknown as Stripe
    expect(await processOrganizationClosureRefund(target, stripe, "test")).toMatchObject({ intent: { state: "uncertain", amount: 999 } })
    vi.stubEnv("WORKSPACE_AI_CLOSURE_REFUNDS_ENABLED", "false")
    expect(await processOrganizationClosureRefund(target, stripe, "test")).toMatchObject({ intent: { state: "succeeded", refund_id: "re_backend", amount: 999 }, dispatchAllowed: false })
    const evidenceCount = (await db.query("select count(*) from public.ai_credit_payment_adjustments")).stdout.trim()
    await processOrganizationClosureRefund(target, stripe, "test")
    expect((await db.query("select count(*) from public.ai_credit_payment_adjustments")).stdout.trim()).toBe(evidenceCount)
    expect(create).toHaveBeenCalledTimes(1)
    expect((await db.query("select amount,status from public.ai_credit_payment_restrictions where kind='refund'")).stdout.trim()).toBe("999|succeeded")
    expect((await db.query("select sum(credits) from public.ai_credit_entries where lot_id=(select lot_id from public.ai_credit_purchase_orders where id=public.fixture_form_id(2511))")).stdout.trim()).toBe("20")
  })
})
