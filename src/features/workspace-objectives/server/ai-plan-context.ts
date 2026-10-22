import "server-only"
import { readAiRun } from "@/features/ai-credits"
import { objectiveActor } from "./objective-actor"
import { aiPlanTargetSchema, aiPlanApplicationSchema, type AiPlanTarget } from "../ai-plan-types"
import { aiPlanProposal } from "../lib/ai-plan-proposal"
import { z } from "zod"

export async function loadPlanObjective(target: AiPlanTarget) {
  aiPlanTargetSchema.parse(target)
  const actor = await objectiveActor(target, true)
  const { data, error } = await actor.client.from("organization_workspace_objectives").select("id,title,description,updated_at,kind,status").eq("org_id", actor.orgId).eq("id", target.objectiveId).maybeSingle()
  if (error || !data || data.kind !== "custom" || data.status === "archived" || data.updated_at !== target.revision) throw new Error("This objective changed. Refresh before asking for a plan.")
  return { ...actor, objective: data }
}
export async function loadAiPlan(id: string, target: AiPlanTarget) {
  z.uuid().parse(id); aiPlanTargetSchema.parse(target)
  const actor = await objectiveActor(target, true)
  const raw = await readAiRun(id, actor.orgId, actor.userId)
  if (!raw) throw new Error("This AI plan is unavailable.")
  const proposal = aiPlanProposal(raw)
  if (proposal.target.objectiveId !== target.objectiveId || proposal.target.userId !== actor.userId || proposal.target.organizationId !== actor.orgId) throw new Error("This proposal belongs to another objective.")
  const { data, error } = await actor.client.rpc("read_workspace_ai_plan_application", { p_org_id: actor.orgId, p_id: id })
  if (error) throw new Error("Unable to confirm whether this plan was applied. Check status before continuing.")
  proposal.application = data ? aiPlanApplicationSchema.parse(data) : null
  return { ...actor, proposal }
}
