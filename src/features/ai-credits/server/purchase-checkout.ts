import "server-only"
import type Stripe from "stripe"
import { bindCheckout, type PurchaseOrder } from "./purchase-store"

export async function createCreditCheckout(order: PurchaseOrder, stripe: Stripe) {
  if (order.paid_at) throw new Error("This purchase is already credited.")
  let session: Stripe.Checkout.Session
  if (order.checkout_session_id) {
    session = await stripe.checkout.sessions.retrieve(order.checkout_session_id)
  } else {
    // A fixed one-hour expiry also bounds retries well inside Stripe's 24-hour
    // idempotency retention. Uncertain old orders never mint a fresh session.
    if (Date.parse(order.expires_at) - Date.now() < 31 * 60_000) throw new Error("Checkout recovery is pending. Wait for this purchase to expire before starting another.")
    const price = await stripe.prices.retrieve(order.price_id)
    if (!price.active || price.type !== "one_time" || price.unit_amount !== order.amount || price.currency !== order.currency || price.livemode !== (order.mode === "live"))
      throw new Error("This credit pack is unavailable.")
    session = await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"], client_reference_id: order.id, adaptive_pricing: { enabled: false },
      line_items: [{ price: order.price_id, quantity: 1 }],
      metadata: { kind: "ai_credit_pack", order_id: order.id, organization_id: order.org_id },
      payment_intent_data: { metadata: { kind: "ai_credit_pack", order_id: order.id } },
      expires_at: Math.floor(Date.parse(order.expires_at) / 1000),
      success_url: order.return_url, cancel_url: order.return_url,
    }, { idempotencyKey: `ai-credit-checkout:${order.mode}:${order.id}` })
    // A crash here is recovered with the same order and provider idempotency key.
    await bindCheckout(order.id, session.id)
  }
  if (session.client_reference_id !== order.id || session.livemode !== (order.mode === "live")) throw new Error("Checkout identity conflict.")
  if (session.status !== "open" || !session.url) throw new Error("This checkout is no longer open. Payment status will update after verification.")
  const url = new URL(session.url)
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("Invalid checkout URL.")
  return { orderId: order.id, url: session.url }
}
