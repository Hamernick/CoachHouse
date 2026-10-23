import "server-only"
import type Stripe from "stripe"
import { z } from "zod"
import { readPurchase, fulfillPurchase } from "./purchase-store"

// Called only by the existing signature-verified Stripe webhook. Fulfillment
// remains available when new checkout is disabled, so paid orders cannot strand.
export async function processAiCreditPurchase(event: Stripe.Event, stripe: Stripe, mode: "test" | "live") {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return false
  const incoming = event.data.object as Stripe.Checkout.Session
  if (incoming.metadata?.kind !== "ai_credit_pack") return false
  if (incoming.livemode !== (mode === "live")) throw new Error("Credit payment mode mismatch.")
  const order = await readPurchase(z.uuid().parse(incoming.metadata.order_id))
  // Retrieve current payment state, rather than trusting a stale event or return URL.
  const session = await stripe.checkout.sessions.retrieve(incoming.id, { expand: ["payment_intent"] })
  if (session.id !== incoming.id || session.mode !== "payment" || session.livemode !== (order.mode === "live") || order.mode !== mode ||
      session.client_reference_id !== order.id || session.metadata?.order_id !== order.id || session.metadata?.kind !== "ai_credit_pack" ||
      session.metadata?.organization_id !== order.org_id || (order.checkout_session_id && order.checkout_session_id !== session.id))
    throw new Error("Credit payment identity mismatch.")
  if (session.payment_status !== "paid") return true
  const payment = session.payment_intent
  if (!payment || typeof payment === "string" || payment.status !== "succeeded" || payment.livemode !== session.livemode ||
      payment.amount_received !== order.amount || payment.currency !== order.currency || payment.metadata.order_id !== order.id ||
      session.amount_total !== order.amount || session.currency !== order.currency)
    throw new Error("Credit payment amount mismatch.")
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 })
  const item = items.data[0]
  if (items.has_more || items.data.length !== 1 || item.quantity !== 1 || item.price?.id !== order.price_id || item.amount_total !== order.amount)
    throw new Error("Credit payment product mismatch.")
  await fulfillPurchase(order, session.id, payment.id)
  return true
}
