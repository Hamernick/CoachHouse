import "server-only"
import { z } from "zod"
import type { createSupabaseServerClient } from "@/lib/supabase/server"
import { objectiveActor } from "./objective-actor"
import { planDraftSchema, planEdgeSchema, type ObjectivePlans, type PlanDraft } from "../plan-types"
import type { ObjectiveMutationResult, ObjectiveScope } from "../island-types"

const plansSchema = z.array(z.object({
  id: z.uuid(), objectiveId: z.uuid(), title: z.string(), revision: z.number().int(),
  stepIds: z.array(z.uuid()), edges: z.array(planEdgeSchema),
}))
export async function readObjectivePlans(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, orgId: string): Promise<ObjectivePlans> {
  const { data, error } = await client.rpc("read_workspace_objective_plans", { p_org_id: orgId })
  // Existing deployments remain usable until this additive migration is approved.
  if (error?.code === "PGRST202" || error?.code === "42883") return { available: false, plans: [] }
  if (error) throw new Error("Unable to load plans. Try refreshing.")
  return { available: true, plans: plansSchema.parse(data) }
}
export async function saveObjectivePlan(scope: ObjectiveScope, input: PlanDraft): Promise<ObjectiveMutationResult> {
  try {
    const { client, orgId } = await objectiveActor(scope, true)
    const draft = planDraftSchema.parse(input)
    const { error } = await client.rpc("save_workspace_objective_plan", { p_org_id: orgId, p_draft: draft })
    if (error) return { ok: false, error: error.code === "40001" ? "This plan or one of its steps changed. Refresh, then reopen the editor." : "Unable to save. Check that connections have no loops and referenced steps still belong to a plan." }
    return { ok: true }
  } catch { return { ok: false, error: "Unable to save this plan. Check your access and plan details." } }
}
