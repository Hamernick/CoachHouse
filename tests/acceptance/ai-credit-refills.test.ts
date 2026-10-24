import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"
import { openRefillSetup, verifyRefillSetup } from "@/features/ai-credits/server/refill-setup"
import { chargeRefill, reconcileRefill, syncRefillPayment } from "@/features/ai-credits/server/refill-payment"
import { processCreditRefillEvent } from "@/features/ai-credits/server/refill-webhook"
import type { RefillAttempt, RefillSetup } from "@/features/ai-credits/server/refill-store"
import { refillInputSchema } from "@/features/ai-credits/refill-types"
const store=vi.hoisted(()=>({rpc:vi.fn(),readRefillSetup:vi.fn(),readRefillAttempt:vi.fn(),recordRefill:vi.fn()}))
vi.mock("@/features/ai-credits/server/refill-store",()=>({...store,refillDb:()=>({rpc:store.rpc})}))
const restrictions=vi.hoisted(()=>({syncCreditPaymentRestrictions:vi.fn()}))
vi.mock("@/features/ai-credits/server/payment-restrictions",()=>restrictions)
const setup:RefillSetup={id:"90000000-0000-4000-8000-000000000001",org_id:"90000000-0000-4000-8000-000000000002",actor_id:"90000000-0000-4000-8000-000000000002",mode:"test",runtime_target:"primary",pack_key:"fixture",price_id:"price_fixture",credits:1000,amount:1000,currency:"usd",threshold:100,monthly_cap:3000,consent_version:"refill-v1",consent_at:new Date().toISOString(),return_url:"http://localhost:3008/workspace",expires_at:new Date(Date.now()+3600000).toISOString(),status:"setup",checkout_session_id:null,customer_id:"cus_fixture",payment_method_id:"pm_fixture",payment_label:null,verified_at:null}
const refill:RefillAttempt={setup,order:{...setup,id:"90000000-0000-4000-8000-000000000003",created_at:new Date().toISOString(),paid_at:null,payment_intent_id:null},attempt:{id:"90000000-0000-4000-8000-000000000003",setup_id:setup.id,run_id:"90000000-0000-4000-8000-000000000004",state:"queued",started_at:null}}
const payment={id:"pi_fixture",status:"succeeded",livemode:false,amount:1000,amount_received:1000,currency:"usd",customer:"cus_fixture",payment_method:"pm_fixture",metadata:{kind:"ai_credit_pack",order_id:refill.order.id,refill_setup_id:setup.id}} as unknown as Stripe.PaymentIntent
const session={id:"cs_fixture",status:"open",mode:"setup",livemode:false,client_reference_id:setup.id,url:"https://checkout.stripe.com/c/fixture",customer:"cus_fixture",metadata:{kind:"ai_credit_refill_setup",setup_id:setup.id,organization_id:setup.org_id},setup_intent:{status:"succeeded",usage:"off_session",livemode:false,customer:"cus_fixture",payment_method:"pm_fixture",metadata:{kind:"ai_credit_refill_setup",setup_id:setup.id}}}
const sdk={prices:{retrieve:vi.fn()},checkout:{sessions:{create:vi.fn(),retrieve:vi.fn()}},paymentMethods:{retrieve:vi.fn()},paymentIntents:{create:vi.fn(),retrieve:vi.fn(),cancel:vi.fn()}}
const stripe=sdk as unknown as Stripe
beforeEach(()=>{
  vi.resetAllMocks();store.rpc.mockResolvedValue({data:true,error:null});store.readRefillSetup.mockResolvedValue(setup);store.readRefillAttempt.mockResolvedValue(refill)
  sdk.prices.retrieve.mockResolvedValue({active:true,type:"one_time",unit_amount:1000,currency:"usd",livemode:false})
  sdk.checkout.sessions.create.mockResolvedValue(session);sdk.checkout.sessions.retrieve.mockResolvedValue({...session,status:"complete"})
  sdk.paymentMethods.retrieve.mockResolvedValue({id:"pm_fixture",type:"card",customer:"cus_fixture",livemode:false,card:{brand:"visa",last4:"4242"}})
  sdk.paymentIntents.create.mockResolvedValue(payment);sdk.paymentIntents.retrieve.mockResolvedValue(payment)
})
afterEach(()=>vi.unstubAllEnvs())
describe("saved-card refill consent and verification",()=>{
  it("rejects unconsented and caller-priced instructions",()=>{
    const input={organizationId:setup.org_id,id:setup.id,pack:"fixture",threshold:100,monthlyPacks:3,consent:true,consentVersion:"refill-v1"}
    expect(refillInputSchema.safeParse(input).success).toBe(true)
    expect(refillInputSchema.safeParse({...input,consent:false}).success).toBe(false)
    expect(refillInputSchema.safeParse({...input,amount:1}).success).toBe(false)
  })
  it("shows exact immutable consent in setup, without creating a payment",async()=>{
    await openRefillSetup(setup,stripe)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({mode:"setup",customer_creation:"always",custom_text:{submit:{message:expect.stringContaining("$30.00 per calendar month (UTC)")}}}),{idempotencyKey:`ai-refill-setup:test:${setup.id}`,maxNetworkRetries:0})
    expect(sdk.paymentIntents.create).not.toHaveBeenCalled()
  })
  it("reuses the setup identity after database binding fails",async()=>{
    store.rpc.mockResolvedValueOnce({error:{message:"offline"}})
    await expect(openRefillSetup(setup,stripe)).rejects.toThrow("confirmation pending")
    await openRefillSetup(setup,stripe)
    expect(sdk.checkout.sessions.create.mock.calls[0]).toEqual(sdk.checkout.sessions.create.mock.calls[1])
  })
  it("requires a currently verified setup intent and saved card",async()=>{
    await verifyRefillSetup(setup.id,"cs_fixture",stripe,"test")
    expect(store.rpc).toHaveBeenCalledWith("verify_ai_credit_refill_setup",{p_input:expect.objectContaining({customer:"cus_fixture",paymentMethod:"pm_fixture",mode:"test"})})
    sdk.checkout.sessions.retrieve.mockResolvedValueOnce({...session,status:"complete",setup_intent:{...session.setup_intent,metadata:null}})
    await expect(verifyRefillSetup(setup.id,"cs_fixture",stripe,"test")).rejects.toThrow("setup mismatch")
    sdk.paymentMethods.retrieve.mockResolvedValueOnce({type:"card",customer:"cus_someone_else",livemode:false,card:{}})
    await expect(verifyRefillSetup(setup.id,"cs_fixture",stripe,"test")).rejects.toThrow("verified saved card")
  })
  it("does not enable incomplete or wrong-mode setups",async()=>{
    sdk.checkout.sessions.retrieve.mockResolvedValueOnce(session)
    expect(await verifyRefillSetup(setup.id,"cs_fixture",stripe,"test")).toBe(false)
    await expect(verifyRefillSetup(setup.id,"cs_fixture",stripe,"live")).rejects.toThrow("identity mismatch")
    expect(store.rpc).not.toHaveBeenCalled()
  })
})
describe("bounded refill payment execution",()=>{
  it("requires atomic admission, uses immutable terms and never retries the SDK automatically",async()=>{
    store.rpc.mockResolvedValueOnce({data:false,error:null})
    expect(await chargeRefill(refill,stripe)).toBe(false)
    expect(sdk.paymentIntents.create).not.toHaveBeenCalled()
    await chargeRefill(refill,stripe)
    expect(sdk.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({amount:1000,currency:"usd",off_session:true,confirm:true,customer:"cus_fixture",payment_method:"pm_fixture"}),{idempotencyKey:`ai-refill-charge:test:${refill.order.id}`,maxNetworkRetries:0,timeout:5000})
    expect(restrictions.syncCreditPaymentRestrictions.mock.invocationCallOrder[0]).toBeLessThan(store.recordRefill.mock.invocationCallOrder[0])
  })
  it("retains an uncertain charge without silently retrying",async()=>{
    sdk.paymentIntents.create.mockRejectedValueOnce(new Error("network response lost"))
    await chargeRefill(refill,stripe)
    expect(store.recordRefill).toHaveBeenLastCalledWith({id:refill.order.id,state:"uncertain",payment:null})
    sdk.paymentIntents.create.mockClear()
    await reconcileRefill({...refill,attempt:{...refill.attempt,state:"uncertain"}},stripe)
    expect(sdk.paymentIntents.create).not.toHaveBeenCalled()
  })
  it("reuses the same provider key only after an explicit owner retry",async()=>{
    await chargeRefill(refill,stripe,setup.actor_id)
    expect(store.rpc).toHaveBeenCalledWith("start_ai_credit_refill_charge",{p_id:refill.order.id,p_actor_id:setup.actor_id})
    expect(sdk.paymentIntents.create.mock.calls[0][1].idempotencyKey).toBe(`ai-refill-charge:test:${refill.order.id}`)
  })
  it("recovers an SCA intent from Stripe's error without granting credits",async()=>{
    sdk.paymentIntents.create.mockRejectedValueOnce({payment_intent:{id:"pi_fixture"}})
    sdk.paymentIntents.retrieve.mockResolvedValueOnce({...payment,status:"requires_action",amount_received:0})
    await chargeRefill(refill,stripe)
    expect(store.recordRefill).toHaveBeenLastCalledWith(expect.objectContaining({state:"requires_action",payment:"pi_fixture"}))
    expect(restrictions.syncCreditPaymentRestrictions).not.toHaveBeenCalled()
  })
  it("recognizes the declined saved card when Stripe clears payment_method",async()=>{
    await syncRefillPayment(refill,{...payment,status:"requires_payment_method",payment_method:null,last_payment_error:{type:"card_error",payment_method:{id:"pm_fixture"} as Stripe.PaymentMethod}},stripe)
    expect(store.recordRefill).toHaveBeenLastCalledWith(expect.objectContaining({state:"requires_action"}))
    expect(restrictions.syncCreditPaymentRestrictions).not.toHaveBeenCalled()
  })
  it.each([{amount:1},{currency:"eur"},{customer:"cus_other"},{payment_method:"pm_other"},{livemode:true},{amount_received:1}])("rejects mismatched payment proof %j",async patch=>{
    await expect(syncRefillPayment(refill,{...payment,...patch},stripe)).rejects.toThrow()
    expect(store.recordRefill).not.toHaveBeenCalled()
  })
  it("does not regrant or rewrite refund evidence after fulfillment",async()=>{
    await syncRefillPayment({...refill,order:{...refill.order,paid_at:new Date().toISOString(),payment_intent_id:payment.id}},payment,stripe)
    expect(store.recordRefill).not.toHaveBeenCalled();expect(restrictions.syncCreditPaymentRestrictions).not.toHaveBeenCalled()
  })
  it("uses current provider truth for delayed webhook events",async()=>{
    const event={type:"payment_intent.payment_failed",livemode:false,data:{object:{...payment,status:"requires_payment_method"}}} as unknown as Stripe.Event
    await processCreditRefillEvent(event,stripe,"test")
    expect(sdk.paymentIntents.retrieve).toHaveBeenCalledWith(payment.id)
    expect(store.recordRefill).toHaveBeenLastCalledWith(expect.objectContaining({state:"succeeded"}))
    await expect(processCreditRefillEvent(event,stripe,"live")).rejects.toThrow("mode mismatch")
  })
})
