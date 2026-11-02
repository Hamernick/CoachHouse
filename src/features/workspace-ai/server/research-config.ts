import "server-only"
import { z } from "zod"
import { createHash } from "node:crypto"
import { researchPublicBriefSchema, type ResearchPublicBrief } from "../lib/research-public-brief"
import { priceAiUsage } from "@/features/ai-credits"
import { RESEARCH_CONTRACT_VERSION } from "../lib/research-skills"
import { workspaceAiConfig } from "./config"
import { researchFormOutputsEnabled, researchDataViewOutputsEnabled } from "./research-output-config"

export function researchConfig(publicBrief?: ResearchPublicBrief) {
  const base = workspaceAiConfig()
  if(!process.env.WORKSPACE_AI_RATE_CARD) throw new Error("Research model and pricing need configuration.")
  // A flag cannot authorize a payload. Price is explicit; no guessed tool tariff.
  const enabled = process.env.WORKSPACE_AI_PUBLIC_RESEARCH_ENABLED === "1"
  const searchPrice = enabled ? z.coerce.number().int().positive().safeParse(process.env.WORKSPACE_AI_PUBLIC_RESEARCH_MICRODOLLARS_PER_CALL) : null
  // Hosted retrieval adds billable input beyond request bytes. Activation must
  // supply a qualified bound for this exact model/tool configuration. No default.
  const inputBound = enabled ? z.coerce.number().int().min(20000).max(2000000).safeParse(process.env.WORKSPACE_AI_PUBLIC_RESEARCH_INPUT_TOKEN_BOUND) : null
  const publicResearchAvailable = Boolean(searchPrice?.success && inputBound?.success)
  if (publicBrief && (!publicResearchAvailable || !researchPublicBriefSchema.safeParse(publicBrief).success)) throw new Error("Public research is unavailable.")
  const privateVersion=`${base.tariff.version}-${RESEARCH_CONTRACT_VERSION}${researchFormOutputsEnabled() ? "-private-forms-v1" : ""}${researchDataViewOutputsEnabled() ? "-project-views-v1" : ""}`
  // Bind all effective prices/bounds without exceeding the existing 80-char quote schema.
  const publicVersion=`public-${createHash("sha256").update(JSON.stringify({base:base.tariff,privateVersion,price:searchPrice?.success?searchPrice.data:null,input:inputBound?.success?inputBound.data:null})).digest("hex").slice(0,40)}`
  const tariff = {...base.tariff,...(publicBrief && searchPrice?.success ? {webSearchMicrodollarsPerCall:searchPrice.data} : {}),version:publicBrief?publicVersion:privateVersion}
  const maxSearchCalls=publicBrief ? 1 : 0, maxRounds=3, maxOutputTokens=1500, maxInputBytes=20000
  const publicInputTokenBound=publicBrief && inputBound?.success ? inputBound.data : undefined
  const price=priceAiUsage({input:publicInputTokenBound ? (maxRounds-1)*maxInputBytes+publicInputTokenBound : maxRounds*maxInputBytes,cachedInput:0,output:maxRounds*maxOutputTokens,webSearchCalls:maxSearchCalls},tariff)
  if(price.credits>125 || price.microdollars>250000) throw new Error("Research pricing exceeds the configured run limit.")
  return {tariff,...(publicInputTokenBound ? {publicInputTokenBound} : {}),...(publicResearchAvailable ? {publicResearchAvailable:true} : {}),maxSearchCalls,maxRounds,maxOutputTokens,maxInputBytes,maxCredits:price.credits,maxCost:price.microdollars}
}
