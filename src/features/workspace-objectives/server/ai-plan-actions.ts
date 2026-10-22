import "server-only"
import { cancelAiRun, readAiAccount } from "@/features/ai-credits"
import { workspaceAiConfig } from "@/features/workspace-ai/generation"
import { aiPlanApplicationSchema, type AiPlanTarget } from "../ai-plan-types"
import { loadAiPlan, loadPlanObjective } from "./ai-plan-context"
export async function quoteAiPlan(target: AiPlanTarget) {
  const config = workspaceAiConfig()
  const actor = await loadPlanObjective(target)
  // Fail before reserving credits if the plan migration is not available.
  const capability = await actor.client.rpc("read_workspace_objective_plans_v2", { p_org_id: actor.orgId })
  if (capability.error) throw new Error("AI planning is not available yet.")
  const account = await readAiAccount(actor.orgId, actor.userId)
  if (!account.enabled) throw new Error("AI is not enabled for this organization.")
  return { maximumCredits: config.maxCredits, tariffVersion: config.tariff.version, account }
}
export async function readAiPlan(id: string, target: AiPlanTarget) { return (await loadAiPlan(id, target)).proposal }
export async function stopAiPlan(id: string, target: AiPlanTarget) {
  const actor = await loadAiPlan(id, target)
  return cancelAiRun(id, actor.orgId, actor.userId)
}
export async function applyAiPlan(id: string, target: AiPlanTarget, undo = false) {
  const actor = await loadAiPlan(id, target)
  const { data, error } = await actor.client.rpc(undo ? "undo_workspace_ai_plan" : "apply_workspace_ai_plan", { p_org_id: actor.orgId, p_id: id })
  if (error) throw new Error(error.code === "40001" ? "This objective or plan changed. Refresh and review the latest work before continuing." : "Unable to confirm this change. Check status before retrying.")
  return aiPlanApplicationSchema.parse(data)
}
