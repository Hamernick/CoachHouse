import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { purchaseOrderSchema, type PurchaseOrder } from "./purchase-store"

export async function findCreditPayment(payment: string, mode: "test" | "live") {
  const { data, error } = await createSupabaseAdminClient().rpc("find_ai_credit_payment", { p_payment: payment, p_mode: mode })
  if (error) throw new Error("Unable to find credit payment.")
  return data ? purchaseOrderSchema.parse(data) : null
}
export async function recordPaymentRestriction(order: PurchaseOrder, payment: string, input: {
  kind: "refund" | "dispute" | "verification"; providerId: string; status: string; amount: number; currency: string; eventKey: string; eventCreated: number
}) {
  const { error } = await createSupabaseAdminClient().rpc("record_ai_credit_payment_restriction", {
    p_order_id: order.id, p_payment: payment, p_mode: order.mode, p_kind: input.kind, p_provider_id: input.providerId,
    p_status: input.status, p_amount: input.amount, p_currency: input.currency,
    p_operation_key: `${order.mode}:${input.eventKey}:${input.kind}:${input.providerId}:${input.status}`, p_event_created: input.eventCreated,
  })
  if (error) throw new Error("Unable to record payment adjustment.")
}
