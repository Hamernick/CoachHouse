import "server-only"
import { priceAiUsage } from "@/features/ai-credits"
import { RESEARCH_CONTRACT_VERSION } from "../lib/research-skills"
import { workspaceAiConfig } from "./config"
import { researchFormOutputsEnabled, researchDataViewOutputsEnabled } from "./research-output-config"

export function researchConfig() {
  const base = workspaceAiConfig()
  if(!process.env.WORKSPACE_AI_RATE_CARD) throw new Error("Research model and pricing need configuration.")
  // Workspace-only research exposes no external search capability. Old tool-price
  // configuration cannot enable it or inflate the reservation for unavailable work.
  const tariff = {...base.tariff,version:`${base.tariff.version}-${RESEARCH_CONTRACT_VERSION}${researchFormOutputsEnabled() ? "-private-forms-v1" : ""}${researchDataViewOutputsEnabled() ? "-project-views-v1" : ""}`}
  const maxSearchCalls=0, maxRounds=3, maxOutputTokens=1500, maxInputBytes=20000
  const price=priceAiUsage({input:maxRounds*maxInputBytes,cachedInput:0,output:maxRounds*maxOutputTokens,webSearchCalls:maxSearchCalls},tariff)
  if(price.credits>125 || price.microdollars>250000) throw new Error("Research pricing exceeds the configured run limit.")
  return {tariff,maxSearchCalls,maxRounds,maxOutputTokens,maxInputBytes,maxCredits:price.credits,maxCost:price.microdollars}
}
