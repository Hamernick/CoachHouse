import "server-only"
import type Stripe from "stripe"
import { z } from "zod"
import { verifyRefillSetup } from "./refill-setup"
import { readRefillAttempt } from "./refill-store"
import { syncRefillPayment } from "./refill-payment"
export async function processCreditRefillEvent(event:Stripe.Event,stripe:Stripe,mode:"test"|"live") {
  if(event.type==="checkout.session.completed") {
    const session=event.data.object
    if(session.metadata?.kind!=="ai_credit_refill_setup")return false
    if(event.livemode!==(mode==="live"))throw new Error("Refill webhook mode mismatch.")
    await verifyRefillSetup(z.uuid().parse(session.metadata.setup_id),session.id,stripe,mode)
    return true
  }
  if(!["payment_intent.succeeded","payment_intent.payment_failed","payment_intent.requires_action","payment_intent.canceled","payment_intent.processing"].includes(event.type))return false
  const incoming=event.data.object as Stripe.PaymentIntent
  if(incoming.metadata?.kind!=="ai_credit_pack"||!incoming.metadata.refill_setup_id)return false
  if(event.livemode!==(mode==="live"))throw new Error("Refill webhook mode mismatch.")
  const refill=await readRefillAttempt(z.uuid().parse(incoming.metadata.order_id))
  if(refill.order.mode!==mode)throw new Error("Refill mode mismatch.")
  await syncRefillPayment(refill,await stripe.paymentIntents.retrieve(incoming.id),stripe)
  return true
}
