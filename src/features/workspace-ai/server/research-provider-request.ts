import "server-only"
import { researchPublicRequest } from "./research-public-request"
import type OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseInputItem, Tool } from "openai/resources/responses/responses"
import { z } from "zod"
import { knowledgeToolDescriptors, tableAnalysisToolDescription, knowledgeReadResultSchema } from "../lib/knowledge-tool-contract"
import { type ResearchRequest } from "../research-types"
import { researchInstructions, researchFormInstructions, conversationResponseInstructions, tableAnalysisInstructions } from "../lib/research-skills"
import { supportsConversationReplies } from "../lib/research-response"
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
export function researchProviderRequest(config: Config, messages: ResponseInputItem[], round = 0, repairUsed = false, conversation = false, tableAnalysis = false): ResearchProviderRequest {
  const tools: Tool[] = !repairUsed && round < config.maxRounds - 1 ? knowledgeToolDescriptors.map(tool => ({
    type: "function", name: tool.name, description: tool.description + (tableAnalysis && tool.name === "read_workspace" ? tableAnalysisToolDescription : ""),
    parameters: z.toJSONSchema(tool.name === "read_workspace" && !tableAnalysis ? tool.providerInputSchema.omit({tableAnalysis:true}) : tool.providerInputSchema), strict: true,
  })) : []
  const params: ResearchProviderRequest = {model:config.tariff.model,store:false,stream:true,service_tier:"default",
    // Explicit mode without breakpoints avoids unpriced cache writes on this model.
    ...(config.tariff.model === "gpt-6.1-sol" ? {prompt_cache_options:{mode:"explicit" as const}} : {}),
    instructions:researchDataViewInstructions(researchFormOutputsEnabled() ? researchFormInstructions : researchInstructions, researchDataViewOutputsEnabled()) + (conversation ? `\n${conversationResponseInstructions}` : "") + (tableAnalysis ? `\n${tableAnalysisInstructions}` : ""),input:messages,tools,
    max_output_tokens:config.maxOutputTokens,include:["reasoning.encrypted_content"],
    text:{format:zodTextFormat(researchProviderOutputSchema(conversation),"workspace_research")},
  }
  if (researchRequestFits(params, config.maxInputBytes)) return params
  const projection = compactResearchToolMessages(messages)
  const compact = projection.compacted ? { ...params, input: projection.messages, instructions: `${params.instructions}\n${researchToolReferenceInstruction}` } : params
  const bounded = Buffer.byteLength(JSON.stringify(compact)) < Buffer.byteLength(JSON.stringify(params)) ? compact : params
  if (researchRequestFits(bounded,config.maxInputBytes)) return bounded
  // A complete CSV result can exceed the next request only because the optional
  // tool declarations remain. Preserve every source/evidence byte and use the
  // existing answer-only completion shape; never spend more or drop unique data.
  const hasCsvCalculation = round > 0 && messages.some(item => {
    if (item.type !== "function_call_output" || typeof item.output !== "string") return false
    try { const parsed=knowledgeReadResultSchema.safeParse(JSON.parse(item.output)); return parsed.success && parsed.data.results.some(record => "evidence" in record && record.evidence.tableAnalysis?.csv) }
    catch { return false }
  })
  if (hasCsvCalculation && tools.length) {
    const answerOnly = {...bounded,tools:[],instructions:`${bounded.instructions}\nThe remaining request budget permits an answer only. Use verified supplied evidence; report missing evidence without guessing or claiming further reads.`}
    if (researchRequestFits(answerOnly,config.maxInputBytes)) return answerOnly
  }
  // The caller still applies the whole-request admission and cost checks.
  return bounded
}

export function researchRequestFits(params: OpenAI.Responses.ResponseCreateParamsStreaming, maximumBytes: number) {
  return Buffer.byteLength(JSON.stringify(params)) <= maximumBytes
}

/** Quote checks known context; admission repeats with the actual submitted request. */
export function assertInitialResearchRequestFits(context: ResearchContext, request: Pick<ResearchRequest, "prompt" | "skill" | "target" | "publicResearch" | "parentRunId">, config: Config, selectedContext: readonly unknown[] = []) {
  if (request.publicResearch && !researchRequestFits(researchPublicRequest(request.publicResearch,config.tariff.model,config.maxOutputTokens),config.maxInputBytes)) throw new ResearchRecoveryError("context_too_large")
  const params = researchProviderRequest(config, [{role:"user",content:researchPrompt(context, request, selectedContext)}], 0, false, supportsConversationReplies(request),hasResearchTableSources(context,selectedContext))
  if (!researchRequestFits(params, config.maxInputBytes)) throw new ResearchRecoveryError("context_too_large")
}

/** Exposing a calculation shape is not a source grant; execution rereads authority. */
export function hasResearchTableSources(context: ResearchContext, records: readonly unknown[] = []) {
  return context.graph.particles.some(item => item.type === "activity" && item.data.widget?.kind === "data_view") ||
    records.some(item => { const record = z.object({file:z.object({format:z.literal("csv")})}).safeParse(item); return record.success })
}
