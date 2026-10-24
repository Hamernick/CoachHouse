"use server"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { creditBillingContext } from "./server/billing-context"
import { allowanceSetup, bindAllowance, grantAllowance } from "./server/allowance-store"
import { monthlyAllowanceSubscription, stripeId, verifyAllowancePeriod } from "./server/allowance-verification"
import type { AiAllowanceSetup } from "./allowance-types"

export async function loadAiAllowance(organizationId: string): Promise<AiAllowanceSetup | null> {
  if (process.env.WORKSPACE_AI_ALLOWANCES_ENABLED !== "true") return null
  const context = await creditBillingContext(organizationId)
  if (context.orgId !== context.actorId || !context.runtime) return null
  const { mode, client } = context.runtime
  const setup = await allowanceSetup(context.orgId, context.actorId, mode)
  if (!setup.rules.length && !setup.grant) return null
  const result: AiAllowanceSetup = { organizationName: setup.organizationName, binding: setup.binding?.subscription_id ?? null, grant: setup.grant, options: [] }
  if (setup.grant) return result
  const { data, error } = await createSupabaseAdminClient({ actorId: context.actorId }).from("subscriptions")
    .select("stripe_subscription_id,stripe_customer_id").eq("user_id", context.actorId).eq("status", "active").contains("metadata", { stripe_mode: mode }).limit(10)
  if (error) throw new Error("Unable to load subscription allowances.")
  for (const row of data ?? []) {
    if (!row.stripe_customer_id || (setup.binding && setup.binding.subscription_id !== row.stripe_subscription_id)) continue
    const subscription = await client.subscriptions.retrieve(row.stripe_subscription_id)
    const eligible = monthlyAllowanceSubscription(subscription, context.actorId, row.stripe_customer_id, mode, setup.rules)
    if (eligible) result.options.push({ id: subscription.id, label: eligible.rule.label, credits: eligible.rule.credits })
  }
  return result.options.length || result.binding ? result : null
}
export async function assignAiAllowance(input: { organizationId: string; subscriptionId: string; operationId: string }) {
  const body = z.object({ organizationId: z.uuid(), subscriptionId: z.string().regex(/^sub_[a-zA-Z0-9_]+$/).max(200), operationId: z.uuid() }).strict().parse(input)
  if (process.env.WORKSPACE_AI_ALLOWANCES_ENABLED !== "true") throw new Error("Subscription allowances are not enabled.")
  const context = await creditBillingContext(body.organizationId)
  if (context.orgId !== context.actorId) throw new Error("Only the organization owner can assign an allowance.")
  if (!context.runtime) throw new Error("Subscription allowance is unavailable.")
  const { mode, client } = context.runtime
  const setup = await allowanceSetup(context.orgId, context.actorId, mode)
  const { data: source, error } = await createSupabaseAdminClient({ actorId: context.actorId }).from("subscriptions")
    .select("stripe_subscription_id,stripe_customer_id").eq("user_id", context.actorId).eq("stripe_subscription_id", body.subscriptionId)
    .eq("status", "active").contains("metadata", { stripe_mode: mode }).maybeSingle()
  if (error || !source?.stripe_customer_id) throw new Error("An active subscription belonging to you is required.")
  const subscription = await client.subscriptions.retrieve(source.stripe_subscription_id)
  const eligible = monthlyAllowanceSubscription(subscription, context.actorId, source.stripe_customer_id, mode, setup.rules)
  const invoiceId = stripeId(subscription.latest_invoice)
  if (!eligible || !invoiceId) throw new Error("No configured monthly allowance is available for this subscription.")
  const period = await verifyAllowancePeriod(subscription, eligible.rule, invoiceId, client)
  const binding = { mode, subscription_id: subscription.id, customer_id: source.stripe_customer_id, owner_id: context.actorId, org_id: context.orgId }
  await bindAllowance(binding, body.operationId)
  await grantAllowance(binding, eligible.rule, period)
  return loadAiAllowance(context.orgId)
}
