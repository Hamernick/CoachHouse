"use server"

import { z } from "zod"
import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import { resolveStripeRuntimeConfigForAudience } from "@/lib/billing/stripe-runtime"
import { env } from "@/lib/env"
import { preparePurchase, readPurchases } from "./server/purchase-store"
import { createCreditCheckout } from "./server/purchase-checkout"
import { readAiAccount } from "./server/accounting"
import { requireCreditOrganization } from "./server/credit-context"

async function purchaseContext(organizationId: string) {
  const { supabase, user, orgId } = await requireCreditOrganization(organizationId)
  const audience = await resolveDevtoolsAudience({ supabase, userId: user.id, fallbackIsTester: resolveTesterMetadata(user.user_metadata ?? null) })
  const runtime = resolveStripeRuntimeConfigForAudience({ isTester: audience.isTester })
  return { orgId, actorId: user.id, runtime }
}
export async function loadCreditPurchases(organizationId: string) {
  const context = await purchaseContext(organizationId)
  const account = await readAiAccount(context.orgId, context.actorId)
  const purchases = process.env.WORKSPACE_AI_PURCHASES_ENABLED === "true" && context.runtime
    ? await readPurchases(context.orgId, context.actorId, context.runtime.mode)
    : { canPurchase: false, packs: [], orders: [] }
  return { account, purchases }
}
export async function startCreditPurchase(input: { organizationId: string; id: string; pack: string }) {
  const body = z.object({ organizationId: z.uuid(), id: z.uuid(), pack: z.string().min(1).max(100) }).strict().parse(input)
  if (process.env.WORKSPACE_AI_PURCHASES_ENABLED !== "true") throw new Error("Credit purchases are not enabled.")
  const context = await purchaseContext(body.organizationId)
  if (context.orgId !== context.actorId) throw new Error("Only the organization owner can buy credits.")
  if (!context.runtime) throw new Error("Credit purchases are unavailable.")
  const site = env.NEXT_PUBLIC_APP_URL ?? env.NEXT_PUBLIC_SITE_URL
  if (!site) throw new Error("Checkout return address is not configured.")
  const returnUrl = new URL("/workspace", site)
  if (returnUrl.protocol !== "https:" && !(context.runtime.mode === "test" && returnUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(returnUrl.hostname))) throw new Error("Checkout requires a secure return address.")
  const order = await preparePurchase({ ...context, id: body.id, pack: body.pack, mode: context.runtime.mode, returnUrl: returnUrl.href })
  return createCreditCheckout(order, context.runtime.client)
}
