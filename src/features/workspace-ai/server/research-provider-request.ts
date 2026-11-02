import "server-only"
import type OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseInputItem, Tool } from "openai/resources/responses/responses"
import { z } from "zod"
import { providerResearchSchema, providerFormResearchSchema, knowledgeSearchSchema, knowledgeReadSchema, type ResearchRequest } from "../research-types"
import { researchInstructions, researchFormInstructions } from "../lib/research-skills"
import { researchFormOutputsEnabled } from "./research-output-config"
import type { researchConfig } from "./research-config"
import type { ResearchContext } from "./research-context"
import { researchPrompt } from "./research-prompt"
import { ResearchRecoveryError } from "./research-recovery"

type Config = ReturnType<typeof researchConfig>

/** One request shape for admission and dispatch; schemas count toward input capacity. */
export function researchProviderRequest(config: Config, messages: ResponseInputItem[], round = 0, repairUsed = false): OpenAI.Responses.ResponseCreateParamsStreaming {
  const tools: Tool[] = !repairUsed && round < config.maxRounds - 1 ? [
    {type:"function",name:"search_workspace",description:"Search authorized workspace records. Return short excerpts and IDs. Narrow kinds and query. Internal retrieval; returned content is supplied to the configured planning model.",parameters:z.toJSONSchema(knowledgeSearchSchema),strict:true},
    {type:"function",name:"read_workspace",description:"Read up to four known workspace references directly, including selected-plan or discovered records. Each reference is reauthorized; search first only when its ID is unknown. contentAvailable=false means metadata only. DOCX document_body scope excludes images, headers and footnotes. Truncated results are excerpts; do not infer missing contents.",parameters:z.toJSONSchema(knowledgeReadSchema),strict:true},
  ] : []
  return {model:config.tariff.model,store:false,stream:true,
    instructions:researchFormOutputsEnabled() ? researchFormInstructions : researchInstructions,input:messages,tools,
    max_output_tokens:config.maxOutputTokens,include:["reasoning.encrypted_content"],
    text:{format:zodTextFormat(researchFormOutputsEnabled() ? providerFormResearchSchema : providerResearchSchema,"workspace_research")},
  }
}

export function researchRequestFits(params: OpenAI.Responses.ResponseCreateParamsStreaming, maximumBytes: number) {
  return Buffer.byteLength(JSON.stringify(params)) <= maximumBytes
}

/** Quote checks known context; admission repeats with the actual submitted request. */
export function assertInitialResearchRequestFits(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target">, config: Config) {
  const params = researchProviderRequest(config, [{role:"user",content:researchPrompt(context, request)}])
  if (!researchRequestFits(params, config.maxInputBytes)) throw new ResearchRecoveryError("context_too_large")
}
