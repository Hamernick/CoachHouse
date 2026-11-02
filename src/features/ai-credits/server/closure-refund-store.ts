import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { purchaseOrderSchema } from "./purchase-store"

export const closureRefundSchema = z.object({
  id: z.uuid(), org_id: z.uuid(), closure_request_id: z.uuid(), closure_revision: z.number().int(), order_id: z.uuid(),
  payment_intent_id: z.string(), mode: z.enum(["test", "live"]), currency: z.string(), amount: z.number().int().positive(),
  paid_minor_units: z.number().int().positive(), purchased_credits: z.number().int().positive(), consumed_credits: z.number().int().nonnegative(),
  state: z.enum(["ready", "dispatching", "uncertain", "pending", "requires_action", "succeeded", "failed", "canceled"]),
  refund_id: z.string().nullable(), reason: z.string().nullable(), started_at: z.string().nullable(),
})
const envelopeSchema = z.object({ intent: closureRefundSchema.nullable(), order: purchaseOrderSchema,
  reason: z.string().nullable().optional(), dispatchAllowed: z.boolean() })
export type ClosureRefund = z.infer<typeof envelopeSchema>
export type ClosureRefundTarget = { organizationId: string; orderId: string; actorId: string }
export async function closureRefundRpc(name: string, args: Record<string, unknown>): Promise<ClosureRefund> {
  const client = createSupabaseAdminClient()
  const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => {
    abortSignal: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }>
  }
  const { data, error } = await rpc(name, args).abortSignal(AbortSignal.timeout(10000))
  if (error) throw new Error("Closure refund reconciliation unavailable.")
  return envelopeSchema.parse(data)
}
export function accessClosureRefund(action: "read" | "prepare" | "claim", target: ClosureRefundTarget) {
  return closureRefundRpc(`${action}_organization_closure_refund`, {
    p_org: z.uuid().parse(target.organizationId), p_order: z.uuid().parse(target.orderId), p_actor: z.uuid().parse(target.actorId),
  })
}
export function recordClosureRefund(intent: NonNullable<ClosureRefund["intent"]>, refund: {
  id: string; status: string; amount: number; currency: string; created: number;
} | null) {
  return closureRefundRpc("record_organization_closure_refund", { p_id: intent.id, p_refund: refund?.id ?? null,
    p_status: refund?.status ?? "uncertain", p_amount: refund?.amount ?? intent.amount, p_currency: refund?.currency ?? intent.currency,
    p_payment: intent.payment_intent_id, p_mode: intent.mode, p_created: refund?.created ?? Math.floor(Date.now() / 1000) })
}
