import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const allowanceRule = z.object({ key: z.string(), mode: z.enum(["test", "live"]), price_id: z.string(), label: z.string(),
  credits: z.number().int().positive(), amount: z.number().int().positive(), currency: z.string(), allow_discounted: z.boolean(), enabled: z.boolean() })
export type AllowanceRule = z.infer<typeof allowanceRule>
const bindingSchema = z.object({ mode: z.enum(["test", "live"]), subscription_id: z.string(), customer_id: z.string(), owner_id: z.uuid(), org_id: z.uuid() })
export type AllowanceBinding = z.infer<typeof bindingSchema>
const setupSchema = z.object({ rules: z.array(allowanceRule), binding: bindingSchema.nullable(), organizationName: z.string(),
  grant: z.object({ label: z.string(), credits: z.number().int().positive(), expiresAt: z.string() }).nullable() })
export async function allowanceSetup(orgId: string, actorId: string, mode: "test" | "live") {
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_ai_credit_allowance_setup", { p_org_id: orgId, p_actor_id: actorId, p_mode: mode })
  if (error) throw new Error("Subscription allowance is unavailable.")
  return setupSchema.parse(data)
}
export async function findAllowanceBinding(subscription: string, mode: "test" | "live") {
  const { data, error } = await createSupabaseAdminClient().rpc("find_ai_credit_subscription_binding", { p_subscription: subscription, p_mode: mode })
  if (error) throw new Error("Unable to verify subscription assignment.")
  return data ? bindingSchema.parse(data) : null
}
export async function bindAllowance(binding: AllowanceBinding, operationId: string) {
  const { error } = await createSupabaseAdminClient({ actorId: binding.owner_id }).rpc("bind_ai_credit_subscription", {
    p_org_id: binding.org_id, p_actor_id: binding.owner_id, p_mode: binding.mode, p_subscription: binding.subscription_id,
    p_customer: binding.customer_id, p_operation_id: operationId,
  })
  if (error) throw new Error(error.message.includes("already assigned") ? "This allowance is already assigned. Changes require review for a future period." : "Unable to assign allowance. Retry this request.")
}
export async function grantAllowance(binding: AllowanceBinding, rule: AllowanceRule, period: { invoiceId: string; start: number; end: number }) {
  const { error } = await createSupabaseAdminClient().rpc("grant_ai_credit_allowance", {
    p_mode: binding.mode, p_subscription: binding.subscription_id, p_customer: binding.customer_id, p_rule_key: rule.key,
    p_invoice: period.invoiceId, p_start: new Date(period.start * 1000).toISOString(), p_end: new Date(period.end * 1000).toISOString(),
  })
  if (error) throw new Error("Allowance confirmation is pending. Retry without creating another assignment.")
}
