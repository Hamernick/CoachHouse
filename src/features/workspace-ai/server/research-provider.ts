import "server-only"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseInputItem, Tool } from "openai/resources/responses/responses"
import { z } from "zod"
import type { AiUsage } from "@/features/ai-credits"
import { generatedResearchSchema, knowledgeSearchSchema, knowledgeReadSchema, type ResearchRequest, type ResearchSource } from "../research-types"
import { researchInstructions, researchSkills } from "../lib/research-skills"
import { bindResearch } from "../lib/research-contract"
import type { researchConfig } from "./research-config"
import type { ResearchContext } from "./research-context"
import { createKnowledgeTools } from "./knowledge-tools"

export async function runResearchProvider(input: {
  request: ResearchRequest; context: ResearchContext; config: ReturnType<typeof researchConfig>;
  onResponse:(id:string)=>Promise<void>; isCanceled:()=>Promise<boolean>;
}) {
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:90000})
  const knowledge=createKnowledgeTools(input.context), config=input.config
  const sources=knowledge.sources
  const tools:Tool[]=[
    {type:"function",name:"search_workspace",description:"Search authorized workspace records. Return short excerpts and IDs. Narrow kinds and query. No external transmission.",parameters:z.toJSONSchema(knowledgeSearchSchema),strict:true},
    {type:"function",name:"read_workspace",description:"Read up to four records already found by search. Some files have metadata only.",parameters:z.toJSONSchema(knowledgeReadSchema),strict:true},
  ]
  const messages:ResponseInputItem[]=[{role:"user",content:JSON.stringify({task:input.request.prompt,objective:{title:input.context.objective.title,description:input.context.objective.description,plans:input.context.objective.data.planning?.plans.slice(0,4).map(plan=>({title:plan.title,particleIds:plan.particleIds.slice(0,8)})),pendingProposals:input.context.objective.data.planning?.proposals.filter(proposal=>proposal.status==="pending").map(proposal=>proposal.title).slice(0,4)},skill:researchSkills[input.request.skill]})}]
  const usage:AiUsage={input:0,cachedInput:0,output:0,webSearchCalls:0}
  let responseId:string|null=null, toolCalls=0
  const deadline=AbortSignal.timeout(90000)
  for(let round=0;round<config.maxRounds;round++) {
    if(await input.isCanceled()) return {canceled:true,usage,responseId,result:null}
    if(Buffer.byteLength(JSON.stringify(messages)+researchInstructions)>config.maxInputBytes) return {canceled:false,usage,responseId,result:null}
    // Final round completes the proposal instead of starting another custom-tool loop.
    const remainingSearches=config.maxSearchCalls-(usage.webSearchCalls ?? 0)
    const available:Tool[]=[...(round<config.maxRounds-1?tools:[]),...(remainingSearches>0?[{type:"web_search" as const,search_context_size:"low" as const}]:[])]
    const params:OpenAI.Responses.ResponseCreateParamsStreaming & {max_tool_calls:number}={model:config.tariff.model,store:false,stream:true,
      instructions:researchInstructions,input:messages,tools:available,max_tool_calls:Math.max(1,remainingSearches),
      max_output_tokens:config.maxOutputTokens,include:["web_search_call.action.sources","reasoning.encrypted_content"],
      text:{format:zodTextFormat(generatedResearchSchema,"workspace_research")},
    }
    const stream=await client.responses.create(params,{signal:deadline,headers:{"X-Client-Request-Id":`${input.request.id}:${round}`}})
    let terminal:OpenAI.Responses.Response|null=null
    for await(const event of stream) {
      if(event.type==="response.created") {responseId=event.response.id;await input.onResponse(responseId)}
      if(event.type==="response.completed"||event.type==="response.incomplete"||event.type==="response.failed") terminal=event.response
    }
    if(!terminal?.usage) throw new Error("Research usage was not confirmed.")
    usage.input+=terminal.usage.input_tokens; usage.cachedInput+=terminal.usage.input_tokens_details.cached_tokens; usage.output+=terminal.usage.output_tokens
    for(const item of terminal.output) {
      if(item.type==="web_search_call") {
        if(item.action.type==="search") usage.webSearchCalls=(usage.webSearchCalls ?? 0)+1
        if(item.action.type==="search" && "sources" in item.action) for(const raw of item.action.sources ?? []) {
          const source=z.object({url:z.url({protocol:/^https?$/})}).safeParse(raw)
          if(source.success && sources.size<40) sources.set(source.data.url,webSource(source.data.url,source.data.url))
        }
      }
      if(item.type==="message") for(const part of item.content) if(part.type==="output_text") for(const annotation of part.annotations) if(annotation.type==="url_citation" && sources.size<40) sources.set(annotation.url,webSource(annotation.url,annotation.title))
    }
    if(terminal.status!=="completed") return {canceled:false,usage,responseId,result:null}
    if(await input.isCanceled()) return {canceled:true,usage,responseId,result:null}
    const calls=terminal.output.filter(item=>item.type==="function_call")
    if(!calls.length) {
      let result=null
      try {result=bindResearch(terminal.output.flatMap(item=>item.type==="message"?item.content.flatMap(part=>part.type==="output_text"?[part.text]:[]):[]).join(""),[...sources.values()],input.request.target,input.request.id)} catch { /* Invalid output is never billable to the member. */ }
      return {canceled:false,usage,responseId,result}
    }
    messages.push(...terminal.output)
    for(const call of calls) {
      if(await input.isCanceled())return {canceled:true,usage,responseId,result:null}
      if(++toolCalls>8) return {canceled:false,usage,responseId,result:null}
      let output:unknown
      try {output=await knowledge.execute(call.name,JSON.parse(call.arguments))} catch {output={error:"This authorized source or tool is unavailable. Do not infer its contents."}}
      messages.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify(output)})
    }
  }
  return {canceled:false,usage,responseId,result:null}
}
function webSource(url:string,title:string):ResearchSource {
  return {id:url,title:title.slice(0,240),href:url,revision:null,checkedAt:new Date().toISOString(),kind:"web"}
}
