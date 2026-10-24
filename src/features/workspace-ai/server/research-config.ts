import "server-only"
import { z } from "zod"
import { priceAiUsage } from "@/features/ai-credits"
import { RESEARCH_CONTRACT_VERSION } from "../lib/research-skills"
import { workspaceAiConfig } from "./config"

export function researchConfig() {
  const base = workspaceAiConfig()
  if(!process.env.WORKSPACE_AI_RATE_CARD) throw new Error("Research model and pricing need configuration.")
  // Search prices must be explicitly reviewed; never silently bill token-only rates.
  const tools = z.object({ webSearchMicrodollarsPerCall:z.number().int().positive().max(100000) }).strict().safeParse(
    process.env.WORKSPACE_AI_RESEARCH_TOOL_PRICES ? JSON.parse(process.env.WORKSPACE_AI_RESEARCH_TOOL_PRICES) : null)
  if(!tools.success) throw new Error("Research tool pricing is not configured yet.")
  const tariff = {...base.tariff,...tools.data,version:`${base.tariff.version}-${RESEARCH_CONTRACT_VERSION}`}
  const maxSearchCalls=2, maxRounds=3, maxOutputTokens=1500, maxInputBytes=20000
  const price=priceAiUsage({input:60000,cachedInput:0,output:maxRounds*maxOutputTokens,webSearchCalls:maxSearchCalls},tariff)
  if(price.credits>125 || price.microdollars>250000) throw new Error("Research pricing exceeds the configured run limit.")
  return {tariff,maxSearchCalls,maxRounds,maxOutputTokens,maxInputBytes,maxCredits:price.credits,maxCost:price.microdollars}
}
