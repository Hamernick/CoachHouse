"use server"
import { z } from "zod"
import { cancelAiRun, readAiAccount } from "@/features/ai-credits"
import { loadResearchContext } from "./server/research-context"
import { assertResearchContextFits } from "./server/research-prompt"
import { researchConfig } from "./server/research-config"
import { readResearchRun } from "./server/research-run"
import { createKnowledgeTools } from "./server/knowledge-tools"
import { knowledgeSearchSchema, type ResearchTarget } from "./research-types"

export async function quoteWorkspaceResearch(target:ResearchTarget) {
  try {
    const context=await loadResearchContext(target),config=researchConfig()
    assertResearchContextFits(context,{target,prompt:"",skill:"planning"},config.maxInputBytes)
    const account=await readAiAccount(target.organizationId,context.user.id)
    if(!account.enabled || account.paymentReview) throw new Error("Research is not enabled for this organization.")
    return {maximumCredits:config.maxCredits,tariffVersion:config.tariff.version}
  } catch(error) {return {error:error instanceof Error?error.message:"Research unavailable."}}
}
export async function getWorkspaceResearch(id:string,target:ResearchTarget) {
  try {return {run:await readResearchRun(id,target)}} catch(error) {return {error:error instanceof Error?error.message:"Research unavailable."}}
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
