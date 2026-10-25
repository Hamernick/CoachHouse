"use server"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireCreditOrganization } from "./server/credit-context"
import type { AiUsageHistory, AiUsageHistoryQuery } from "./usage-types"

const result = z.object({ canFilterMembers: z.boolean(), members: z.array(z.object({ id: z.uuid(), name: z.string() })),
  hasMore: z.boolean(), rows: z.array(z.object({ id: z.uuid(), created_at: z.string(), status: z.string(), task: z.enum(["document", "plan"]),
    charged_credits: z.number().int().nonnegative().nullable(), max_credits: z.number().int().nonnegative(),
    actorId: z.uuid(), actorName: z.string(), resourceTitle: z.string().nullable(), sectionId: z.string().nullable(),
  })),
})
export async function loadAiUsageHistory(input: AiUsageHistoryQuery): Promise<AiUsageHistory> {
  const body = z.object({ organizationId: z.uuid(), memberId: z.uuid().nullish(), task: z.enum(["document", "plan"]).nullish(),
    before: z.object({ at: z.iso.datetime({ offset: true }), id: z.uuid() }).strict().nullish(),
  }).strict().parse(input)
  const { orgId, actorId } = await requireCreditOrganization(body.organizationId)
  if (actorId !== orgId && body.memberId && body.memberId !== actorId) throw new Error("You can view your own AI usage.")
  const { data, error } = await createSupabaseAdminClient({ actorId }).rpc("read_workspace_ai_usage", {
    p_org_id: orgId, p_actor_id: actorId, p_member_id: body.memberId ?? null, p_task: body.task ?? null,
    p_before_at: body.before?.at ?? null, p_before_id: body.before?.id ?? null,
  })
  if (error) throw new Error("Unable to load AI usage.")
  return result.parse(data)
}
