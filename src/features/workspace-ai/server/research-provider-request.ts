import "server-only"
import { researchPublicRequest } from "./research-public-request"
import type OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseInputItem, Tool } from "openai/resources/responses/responses"
import { z } from "zod"
import { knowledgeToolDescriptors } from "../lib/knowledge-tool-contract"
import { type ResearchRequest } from "../research-types"
import { researchInstructions, researchFormInstructions } from "../lib/research-skills"
import { researchFormOutputsEnabled, researchDataViewOutputsEnabled, researchProviderOutputSchema } from "./research-output-config"
import type { researchConfig } from "./research-config"
import type { ResearchContext } from "./research-context"
import { researchPrompt } from "./research-prompt"
import { ResearchRecoveryError } from "./research-recovery"
import { researchDataViewInstructions } from "../lib/research-data-view-instructions"
import { compactResearchToolMessages, researchToolReferenceInstruction } from "./research-tool-message-compaction"

type Config = ReturnType<typeof researchConfig>
type ResearchProviderRequest = OpenAI.Responses.ResponseCreateParamsStreaming & {
  prompt_cache_options?: { mode: "explicit" }
}

/** One request shape for admission and dispatch; schemas count toward input capacity. */
export function researchProviderRequest(config: Config, messages: ResponseInputItem[], round = 0, repairUsed = false): ResearchProviderRequest {
  const tools: Tool[] = !repairUsed && round < config.maxRounds - 1 ? knowledgeToolDescriptors.map(tool => ({
    type: "function", name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.providerInputSchema), strict: true,
  })) : []
  const params: ResearchProviderRequest = {model:config.tariff.model,store:false,stream:true,service_tier:"default",
    // Explicit mode without breakpoints avoids unpriced cache writes on this model.
    ...(config.tariff.model === "gpt-6.1-sol" ? {prompt_cache_options:{mode:"explicit" as const}} : {}),
    instructions:researchDataViewInstructions(researchFormOutputsEnabled() ? researchFormInstructions : researchInstructions, researchDataViewOutputsEnabled()),input:messages,tools,
    max_output_tokens:config.maxOutputTokens,include:["reasoning.encrypted_content"],
    text:{format:zodTextFormat(researchProviderOutputSchema(),"workspace_research")},
  }
  if (researchRequestFits(params, config.maxInputBytes)) return params
  const projection = compactResearchToolMessages(messages)
  if (!projection.compacted) return params
  const compact = { ...params, input: projection.messages, instructions: `${params.instructions}\n${researchToolReferenceInstruction}` }
  // Never trade the byte ceiling or unique evidence for a successful dispatch.
  // The caller still applies the same whole-request admission and cost checks.
  return Buffer.byteLength(JSON.stringify(compact)) < Buffer.byteLength(JSON.stringify(params)) ? compact : params
}

export function researchRequestFits(params: OpenAI.Responses.ResponseCreateParamsStreaming, maximumBytes: number) {
  return Buffer.byteLength(JSON.stringify(params)) <= maximumBytes
}

/** Quote checks known context; admission repeats with the actual submitted request. */
export function assertInitialResearchRequestFits(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target" | "publicResearch">, config: Config) {
  if (request.publicResearch && !researchRequestFits(researchPublicRequest(request.publicResearch,config.tariff.model,config.maxOutputTokens),config.maxInputBytes)) throw new ResearchRecoveryError("context_too_large")
  const params = researchProviderRequest(config, [{role:"user",content:researchPrompt(context, request)}])
  if (!researchRequestFits(params, config.maxInputBytes)) throw new ResearchRecoveryError("context_too_large")
}
