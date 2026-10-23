import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AiCreditPurchases } from "../purchase-types"

export const purchaseOrderSchema = z.object({
  id: z.uuid(), org_id: z.uuid(), actor_id: z.uuid(), pack_key: z.string(),
  mode: z.enum(["test", "live"]), price_id: z.string(), credits: z.number().int().positive(),
  amount: z.number().int().positive(), currency: z.string(), return_url: z.url(),
  expires_at: z.string(), created_at: z.string(), checkout_session_id: z.string().nullable(), paid_at: z.string().nullable(),
  payment_intent_id: z.string().nullable().optional(),
})
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>
export async function preparePurchase(input: { id: string; orgId: string; actorId: string; pack: string; mode: "test" | "live"; returnUrl: string }) {
  const { data, error } = await createSupabaseAdminClient({ actorId: input.actorId }).rpc("prepare_ai_credit_purchase", {
    p_id: input.id, p_org_id: input.orgId, p_actor_id: input.actorId, p_pack: input.pack, p_mode: input.mode, p_return_url: input.returnUrl,
  })
  if (error) throw new Error(error.message)
  return purchaseOrderSchema.parse(data)
}
export async function readPurchase(id: string) {
  const { data, error } = await createSupabaseAdminClient().rpc("read_ai_credit_purchase_order", { p_id: id })
  if (error || !data) throw new Error("Credit purchase unavailable.")
  return purchaseOrderSchema.parse(data)
}
export async function bindCheckout(id: string, session: string) {
  const { error } = await createSupabaseAdminClient().rpc("bind_ai_credit_checkout", { p_id: id, p_session: session })
  if (error) throw new Error("Unable to record checkout. Retry this purchase.")
}
export async function fulfillPurchase(order: PurchaseOrder, session: string, payment: string) {
  const { error } = await createSupabaseAdminClient().rpc("fulfill_ai_credit_purchase", {
    p_id: order.id, p_session: session, p_payment: payment, p_mode: order.mode, p_amount: order.amount, p_currency: order.currency,
  })
  if (error) throw new Error("Unable to credit purchase.")
}
export async function readPurchases(orgId: string, actorId: string, mode: "test" | "live"): Promise<AiCreditPurchases> {
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_ai_credit_purchases", { p_org_id: orgId, p_actor_id: actorId, p_mode: mode })
  if (error) throw new Error("Credit purchases are unavailable.")
  return z.object({ canPurchase: z.boolean(), packs: z.array(z.object({ key: z.string(), credits: z.number(), amount: z.number(), currency: z.string() })),
    orders: z.array(z.object({ id: z.uuid(), credits: z.number(), amount: z.number(), currency: z.string(), created_at: z.string(), status: z.enum(["pending", "paid", "expired"]),
      paymentIssue: z.enum(["refunded", "partially_refunded", "refund_pending", "disputed", "verification_pending"]).nullable().optional() })),
  }).parse(data)
}
