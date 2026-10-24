import "server-only"
import type Stripe from "stripe"
import { recordRefill, refillDb, readRefillAttempt, type RefillAttempt } from "./refill-store"
import { syncCreditPaymentRestrictions } from "./payment-restrictions"
const providerOptions={timeout:5000,maxNetworkRetries:0}
const id=(value:string|{id:string}|null|undefined)=>typeof value==="string"?value:value?.id
export async function syncRefillPayment(refill:RefillAttempt,payment:Stripe.PaymentIntent,stripe:Stripe) {
  const {order,setup}=refill
  const method=id(payment.payment_method)??(payment.status==="requires_payment_method"?id(payment.last_payment_error?.payment_method):undefined)
  if(payment.livemode!==(order.mode==="live")||payment.amount!==order.amount||payment.currency!==order.currency||id(payment.customer)!==setup.customer_id||method!==setup.payment_method_id||payment.metadata.kind!=="ai_credit_pack"||payment.metadata.order_id!==order.id||payment.metadata.refill_setup_id!==setup.id||(order.payment_intent_id&&order.payment_intent_id!==payment.id))throw new Error("Refill payment identity mismatch.")
  // Fulfilled purchases use the existing signed refund/dispute recovery path.
  if(order.paid_at)return
  const state=payment.status==="succeeded"?"succeeded":payment.status==="canceled"?"canceled":payment.status==="processing"?"processing":"requires_action"
  if(state==="succeeded") {
    if(payment.amount_received!==order.amount)throw new Error("Refill amount mismatch.")
    await syncCreditPaymentRestrictions(order,payment.id,stripe,{key:`refill:${order.id}:${payment.id}`,created:Math.floor(Date.now()/1000)},providerOptions)
  }
  await recordRefill({id:order.id,state,payment:payment.id,mode:order.mode,amount:payment.amount,currency:payment.currency,customer:setup.customer_id,paymentMethod:setup.payment_method_id})
}
export async function chargeRefill(refill:RefillAttempt,stripe:Stripe,retryActor?:string) {
  const {data:start,error}=await refillDb().rpc("start_ai_credit_refill_charge",{p_id:refill.order.id,...(retryActor?{p_actor_id:retryActor}:{})})
  if(error)throw new Error("Refill admission unavailable.")
  if(!start)return false
  try {
    const {order,setup}=refill
    if(!setup.customer_id||!setup.payment_method_id)throw new Error("Saved payment method unavailable.")
    const payment=await stripe.paymentIntents.create({amount:order.amount,currency:order.currency,customer:setup.customer_id,payment_method:setup.payment_method_id,
      off_session:true,confirm:true,payment_method_types:["card"],metadata:{kind:"ai_credit_pack",order_id:order.id,refill_setup_id:setup.id},
    },{idempotencyKey:`ai-refill-charge:${order.mode}:${order.id}`,...providerOptions})
    await syncRefillPayment(refill,payment,stripe)
  } catch(error) {
    // Stripe's declined/SCA errors can contain the already-created intent. Never
    // create another intent merely because the response or DB write failed.
    const candidate=error&&typeof error==="object"&&"payment_intent" in error?error.payment_intent:null
    if(candidate&&typeof candidate==="object"&&"id" in candidate&&typeof candidate.id==="string") {
      const current=await stripe.paymentIntents.retrieve(candidate.id,providerOptions)
      await syncRefillPayment(refill,current,stripe)
    } else await recordRefill({id:refill.order.id,state:"uncertain",payment:null})
  }
  return true
}
export async function reconcileRefill(refill:RefillAttempt,stripe:Stripe) {
  if(refill.order.payment_intent_id) {
    await syncRefillPayment(refill,await stripe.paymentIntents.retrieve(refill.order.payment_intent_id,providerOptions),stripe)
  } else if(refill.attempt.state==="charging"&&refill.attempt.started_at&&Date.parse(refill.attempt.started_at)<Date.now()-90000) {
    await recordRefill({id:refill.order.id,state:"uncertain",payment:null})
  }
}
export async function cancelRefill(idValue:string,actorId:string,mode:"test"|"live",stripe:Stripe) {
  const refill=await readRefillAttempt(idValue)
  if(refill.setup.actor_id!==actorId||refill.setup.org_id!==actorId||refill.setup.mode!==mode)throw new Error("Refill access denied.")
  if(!refill.order.payment_intent_id)throw new Error("Payment verification is still pending. No additional refill will be started.")
  let payment=await stripe.paymentIntents.retrieve(refill.order.payment_intent_id,providerOptions)
  if(payment.status!=="succeeded"&&payment.status!=="canceled")payment=await stripe.paymentIntents.cancel(payment.id,{}, {idempotencyKey:`ai-refill-cancel:${mode}:${refill.order.id}`,...providerOptions})
  await syncRefillPayment(refill,payment,stripe)
}
