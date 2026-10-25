import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"
import { priceAiUsage } from "../lib"
import type { AiCreditAccount, AiRateCard, AiUsage } from "../types"

// actorId is always supplied by a server-verified session. SQL independently
// checks organization membership; these helpers are not public server actions.
export async function reserveAiRun(input: {
  id: string; organizationId: string; actorId: string; hash: string; task?: "plan" | "research";
  target: Json; prompt: string; tariff: AiRateCard; maxCredits: number; maxCost: number
}) {
  const { data, error } = await createSupabaseAdminClient({ actorId: input.actorId }).rpc(input.task === "research" ? "reserve_workspace_ai_research_run" : input.task === "plan" ? "reserve_workspace_ai_plan_run" : "reserve_workspace_ai_run", {
    p_id: input.id, p_org_id: input.organizationId, p_actor_id: input.actorId, p_hash: input.hash,
    p_target: input.target, p_prompt: input.prompt, p_tariff: input.tariff,
    p_max_credits: input.maxCredits, p_max_cost: input.maxCost,
  })
  if (error) throw new Error(error.message)
  return z.object({ created: z.boolean(), run: z.record(z.string(),z.unknown()) }).parse(data)
}
export async function claimAiRun(id: string, actorId: string) {
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("claim_workspace_ai_run", { p_id: id, p_actor_id: actorId })
  if (error) throw new Error(error.message)
  return data
}
export async function settleAiRun(input: {
  id: string; status: "succeeded" | "failed" | "canceled"; usage: AiUsage;
  tariff: AiRateCard; maxCredits: number; proposal: string | null; responseId: string | null
}) {
  const price = priceAiUsage(input.usage, input.tariff)
  const { error } = await createSupabaseAdminClient({ requestTimeoutMs: 10000 }).rpc("record_workspace_ai_result", {
    p_id: input.id, p_status: input.status, p_cost: price.microdollars,
    p_credits: input.status === "succeeded" ? Math.min(price.credits, input.maxCredits) : 0,
    p_proposal: input.proposal, p_usage: input.usage, p_response_id: input.responseId,
  })
  if (error) throw new Error(error.message)
  const settlement = await createSupabaseAdminClient({ requestTimeoutMs: 10000 }).rpc("settle_recorded_workspace_ai_run", { p_id: input.id })
  if (settlement.error) throw new Error(settlement.error.message)
  return settlement.data
}
export async function correlateAiResponse(id: string, responseId: string) {
  const { error } = await createSupabaseAdminClient({ requestTimeoutMs: 10000 }).rpc("correlate_workspace_ai_response", { p_id: id, p_response_id: responseId })
  if (error) throw new Error("Unable to record provider correlation.")
}
export async function reconcileAiRun(id: string, responseId: string | null) {
  const { error } = await createSupabaseAdminClient().rpc("reconcile_workspace_ai_run", { p_id: id, p_response_id: responseId })
  if (error) throw new Error(error.message)
}
export async function cancelAiRun(id: string, organizationId: string, actorId: string) {
  const { data,error } = await createSupabaseAdminClient({ actorId }).rpc("cancel_workspace_ai_run", {
    p_id: id, p_org_id: organizationId, p_actor_id: actorId,
  })
  if (error) throw new Error("Unable to stop this request. Check its status.")
  return data
}
export async function readAiRun(id: string, organizationId: string, actorId: string) {
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_workspace_ai_run", { p_id: id, p_org_id: organizationId, p_actor_id: actorId })
  if (error) throw new Error(error.message)
  return data
}
export async function readAiAccount(organizationId: string, actorId: string): Promise<AiCreditAccount> {
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_workspace_ai_account", { p_org_id: organizationId, p_actor_id: actorId })
  if (error) throw new Error("AI usage is unavailable.")
  return z.object({ enabled: z.boolean(), paymentReview: z.boolean().default(false), lots: z.array(z.object({
    kind: z.enum(["included", "purchased", "adjustment"]), expiresAt: z.string().nullable(),
    credits: z.number(), spent: z.number(), reserved: z.number(), expired: z.boolean().default(false), restricted: z.boolean().default(false),
  })), history: z.array(z.object({ id: z.uuid(), status: z.string(), created_at: z.string(),
    charged_credits: z.number().nullable(), max_credits: z.number(), settled_at: z.string().nullable(),
  })) }).parse(data)
}

export async function correlateAiResearchResponse(id: string, responseId: string) {
  const { error } = await createSupabaseAdminClient({ requestTimeoutMs: 10000 }).rpc("correlate_workspace_ai_research_response", { p_id: id, p_response_id: responseId })
  if (error) throw new Error("Unable to record research response.")
}
