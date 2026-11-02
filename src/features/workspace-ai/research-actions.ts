"use server"
import { z } from "zod"
import { researchPublicBriefSchema, type ResearchPublicBrief } from "./lib/research-public-brief"
import { aiCreditBalance, cancelAiRun, readAiAccount, listAiResearchRuns } from "@/features/ai-credits"
import { loadResearchContext } from "./server/research-context"
import { assertInitialResearchRequestFits } from "./server/research-provider-request"
import { researchConfig } from "./server/research-config"
import { readResearchRun } from "./server/research-run"
import { createKnowledgeTools } from "./server/knowledge-tools"
import { knowledgeSearchSchema, researchHistorySchema, type ResearchTarget } from "./research-types"
import { researchRecoveryResponse } from "./server/research-recovery"

export async function quoteWorkspaceResearch(target:ResearchTarget, publicBrief?: ResearchPublicBrief) {
  try {
    const approved = publicBrief === undefined ? undefined : researchPublicBriefSchema.parse(publicBrief)
    const context=await loadResearchContext(target),config=researchConfig(approved)
    assertInitialResearchRequestFits(context,{target,prompt:"",skill:"planning"},config)
    const account=await readAiAccount(target.organizationId,context.user.id)
    if(!account.enabled || account.paymentReview) throw new Error("Research is not enabled for this organization.")
    return {maximumCredits:config.maxCredits,tariffVersion:config.tariff.version,provider:"OpenAI" as const,model:config.tariff.model,availableCredits:aiCreditBalance(account).available,...(config.publicResearchAvailable ? {publicResearchAvailable:true} : {})}
  } catch(error) {return researchRecoveryResponse(error,"admission_unavailable")}
}
export async function getWorkspaceResearch(id:string,target:ResearchTarget) {
  try {return {run:await readResearchRun(id,target)}} catch(error) {return researchRecoveryResponse(error)}
}
export async function listWorkspaceResearch(target: ResearchTarget) {
  try {
    const context = await loadResearchContext(target, false)
    const runs = researchHistorySchema.parse(await listAiResearchRuns({
      organizationId: context.activeOrg.orgId, actorId: context.user.id,
      objectiveId: context.objective?.id ?? null, canvasId: context.canvasId, planId: target.plan?.id ?? null,
    }))
    return { runs }
  } catch { return { error: "Previous research could not be loaded. Try again." } }
}
export async function stopWorkspaceResearch(id:string,target:ResearchTarget) {
  try {
    z.uuid().parse(id)
    await readResearchRun(id,target)
    const context=await loadResearchContext(target,false)
    await cancelAiRun(id,target.organizationId,context.user.id)
    return {ok:true}
  } catch {return {error:"Research could not be stopped. Check status."}}
}
/** Shared search action for a UI context picker, with identical access boundaries. */
export async function searchWorkspaceKnowledge(target:ResearchTarget,query:unknown) {
  const context=await loadResearchContext(target,false)
  return createKnowledgeTools(context).execute("search_workspace",knowledgeSearchSchema.parse(query))
}
