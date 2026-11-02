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

type Config = ReturnType<typeof researchConfig>

/** One request shape for admission and dispatch; schemas count toward input capacity. */
export function researchProviderRequest(config: Config, messages: ResponseInputItem[], round = 0, repairUsed = false): OpenAI.Responses.ResponseCreateParamsStreaming {
  const tools: Tool[] = !repairUsed && round < config.maxRounds - 1 ? knowledgeToolDescriptors.map(tool => ({
    type: "function", name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.providerInputSchema), strict: true,
  })) : []
  return {model:config.tariff.model,store:false,stream:true,
    instructions:researchDataViewInstructions(researchFormOutputsEnabled() ? researchFormInstructions : researchInstructions, researchDataViewOutputsEnabled()),input:messages,tools,
    max_output_tokens:config.maxOutputTokens,include:["reasoning.encrypted_content"],
    text:{format:zodTextFormat(researchProviderOutputSchema(),"workspace_research")},
  }
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
