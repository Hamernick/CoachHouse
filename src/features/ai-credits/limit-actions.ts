"use server"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireCreditOrganization } from "./server/credit-context"
import type { AiCreditLimits } from "./limit-types"

const limit = z.object({ limit: z.number().int().nonnegative().nullable(), used: z.number().nonnegative(), revision: z.uuid().nullable() })
const limits = z.object({ canManage: z.boolean(), resetsAt: z.string(), organization: limit,
  members: z.array(limit.extend({ memberId: z.uuid(), name: z.string() })),
})
export async function loadAiCreditLimits(organizationId: string): Promise<AiCreditLimits> {
  const { orgId, actorId } = await requireCreditOrganization(organizationId)
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_ai_credit_limits", { p_org_id: orgId, p_actor_id: actorId })
  if (error) throw new Error("Spending limits are unavailable.")
  return limits.parse(data)
}
export async function saveAiCreditLimit(input: { organizationId: string; memberId: string | null; limit: number | null; revision: string | null; operationId: string }): Promise<AiCreditLimits> {
  const body = z.object({ organizationId: z.uuid(), memberId: z.uuid().nullable(), limit: z.number().int().min(0).max(100000000).nullable(), revision: z.uuid().nullable(), operationId: z.uuid() }).strict().parse(input)
  const { orgId, actorId } = await requireCreditOrganization(body.organizationId)
  if (orgId !== actorId) throw new Error("Only the organization owner can change spending limits.")
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("set_ai_credit_limit", {
    p_org_id: orgId, p_actor_id: actorId, p_member_id: body.memberId, p_limit: body.limit, p_revision: body.revision, p_operation_id: body.operationId,
  })
  if (error) throw new Error(error.message.includes("Spending limit changed") ? "Spending limit changed. Reload limits before saving." : "Unable to save this limit. Your changes are still here.")
  return limits.parse(data)
}
