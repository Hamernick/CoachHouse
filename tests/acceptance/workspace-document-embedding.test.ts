import { embeddingDisclosureFixture } from "./fixtures/document-embedding-fixtures"
import { configuredDocumentEmbedding, resolveDocumentEmbeddingConfig } from "@/features/workspace-ai/server/document-embedding-config"
import { savedResearchProcessing } from "@/features/workspace-ai/lib/research-processing"
import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { priceAiUsage, reserveAiRun, settleAiRun, reconcileAiRun, type AiUsage } from "@/features/ai-credits"
import { createDocumentEmbedding, withDocumentEmbeddingBudget, type DocumentEmbeddingTransport } from "@/features/workspace-ai/server/document-embedding"
const base = { tariff: { version:"fixture",model:"answer-fixture",inputMicrodollarsPerMillion:1000000,cachedMicrodollarsPerMillion:0,
  outputMicrodollarsPerMillion:1000000,microdollarsPerCredit:2000 },maxSearchCalls:0,maxRounds:3,maxInputBytes:20000,maxOutputTokens:3000,maxCost:69000,maxCredits:35 }
const policy = { model:"embedding-fixture",dimensions:2,microdollarsPerMillion:100000,maxCalls:3,maxInputBytes:100,maxInputTokens:200 }
const config = withDocumentEmbeddingBudget(base,policy)
const transport = vi.fn<DocumentEmbeddingTransport>()
const usage = ():AiUsage => ({input:100,cachedInput:0,output:20})
const setup = (extra:Partial<Parameters<typeof createDocumentEmbedding>[0]> = {}) => createDocumentEmbedding({runId:"run",config,usage:usage(),signal:new AbortController().signal,isCanceled:async()=>false,transport,...extra})
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({data:null,error:null}); transport.mockImplementation(async request => ({model:request.model,inputTokens:2,vectors:request.input.map(()=>[1,0])})) })
it("adds explicit embedding exposure and binds model, dimensions, price and bounds to the existing quote",async()=>{
 expect(config.maxCost).toBe(69020)
 expect(config.tariff.embedding).toMatchObject({model:policy.model,dimensions:policy.dimensions,maxCalls:policy.maxCalls})
 for(const change of [{model:"another"},{dimensions:3},{microdollarsPerMillion:200000},{maxCalls:2},{maxInputBytes:50},{maxInputTokens:100}])
  expect(withDocumentEmbeddingBudget(base,{...policy,...change}).tariff.version).not.toBe(config.tariff.version)
 rpc.mockResolvedValueOnce({data:{created:true,run:{}},error:null})
 await reserveAiRun({id:"run",organizationId:"org",actorId:"actor",hash:"quoted",task:"research",target:{},prompt:"question",tariff:config.tariff,maxCost:config.maxCost,maxCredits:config.maxCredits})
 expect(rpc).toHaveBeenCalledWith("reserve_workspace_ai_research_run",expect.objectContaining({p_max_cost:69020,p_tariff:config.tariff}))
})
it("rejects invalid policy, missing tariffs and excessive combined reservations",()=>{
 for(const bad of [{maxCalls:0},{maxInputBytes:Infinity},{maxInputTokens:-1},{dimensions:0},{microdollarsPerMillion:0}])
  expect(()=>withDocumentEmbeddingBudget(base,{...policy,...bad})).toThrow()
 expect(()=>withDocumentEmbeddingBudget({...base,maxCost:250000},policy)).toThrow()
 expect(()=>setup({config:{...config,embedding:{...policy,model:"unquoted"}}})).toThrow("tariff changed")
 expect(()=>priceAiUsage({...usage(),embeddingInput:2},base.tariff)).toThrow("Missing embedding tariff")
 for(const embeddingInput of [-1,NaN,Infinity,1.5]) expect(()=>priceAiUsage({...usage(),embeddingInput},config.tariff)).toThrow()
})
it("counts actual embedding usage with inference in the existing immutable result receipt",async()=>{
 const used=usage(), controller=setup({usage:used})
 await controller.embed(["source"]); await controller.embed(["query"])
 expect(used.embeddingInput).toBe(4)
 expect(transport.mock.calls.map(([request])=>request.requestId)).toEqual(["run:embedding:1","run:embedding:2"])
 await settleAiRun({id:"run",status:"succeeded",usage:used,tariff:config.tariff,maxCredits:config.maxCredits,proposal:"answer",responseId:"answer-id"})
 expect(rpc.mock.calls[0]).toEqual(["record_workspace_ai_result",expect.objectContaining({p_cost:121,p_credits:1,p_usage:used})])
 expect(rpc.mock.calls[1][0]).toBe("settle_recorded_workspace_ai_run")
})
it.each(["failed","canceled"] as const)("retains measured embedding expense with zero customer credits for %s",async status=>{
 const used=usage();await setup({usage:used}).embed(["source"])
 await settleAiRun({id:"run",status,usage:used,tariff:config.tariff,maxCredits:config.maxCredits,proposal:null,responseId:null})
 expect(rpc.mock.calls[0][1]).toMatchObject({p_cost:121,p_credits:0,p_usage:{embeddingInput:2}})
})
it("enforces UTF-8 input, cumulative tokens, dispatch count and the shared cost limit before transport",async()=>{
 await expect(setup().embed(["é".repeat(51)])).rejects.toThrow("limit")
 await expect(setup({usage:{...usage(),embeddingInput:199}}).embed(["query"])).rejects.toThrow("limit")
 await expect(setup({config:{...config,maxCost:1}}).embed(["query"])).rejects.toThrow("reservation")
 expect(transport).not.toHaveBeenCalled()
 const controller=setup();for(let i=0;i<3;i++)await controller.embed(["query"])
 await expect(controller.embed(["query"])).rejects.toThrow("limit")
 expect(transport).toHaveBeenCalledTimes(3)
})
it("denies revoked/canceled admission and serializes concurrent dispatches",async()=>{
 await expect(setup({isCanceled:async()=>true}).embed(["query"])).rejects.toThrow("canceled")
 await expect(setup({isCanceled:async()=>{throw Error("access denied")}}).embed(["query"])).rejects.toThrow("access denied")
 expect(transport).not.toHaveBeenCalled()
 let finish!:()=>void
 transport.mockImplementationOnce(async()=>{await new Promise<void>(resolve=>{finish=resolve});return {model:policy.model,inputTokens:2,vectors:[[1,0]]}})
 const controller=setup(), pending=controller.embed(["query"])
 await vi.waitFor(()=>expect(transport).toHaveBeenCalledOnce())
 await expect(controller.embed(["query"])).rejects.toThrow("in progress")
 finish();await pending
})
it("keeps known expense when canceled after a completed dispatch",async()=>{
 let canceled=false;const used=usage()
 transport.mockImplementationOnce(async()=>{canceled=true;return {model:policy.model,inputTokens:2,vectors:[[1,0]]}})
 const controller=setup({usage:used,isCanceled:async()=>canceled})
 await expect(controller.embed(["query"])).rejects.toThrow("canceled")
 expect(used.embeddingInput).toBe(2);expect(()=>controller.assertHealthy()).not.toThrow()
})
it.each(["lost reply","wrong model","missing usage","excess usage","aborted"])("poisons uncertain %s so safe tool fallbacks cannot settle zero cost or retry",async failure=>{
 const abort=new AbortController(),used=usage()
 transport.mockImplementationOnce(async()=>{
  if(failure==="lost reply")throw Error("private provider detail")
  if(failure==="aborted"){abort.abort();throw Error("aborted")}
  return {model:failure==="wrong model"?"other":policy.model,inputTokens:failure==="missing usage"?NaN:1000,vectors:[[1,0]]}
 })
 const controller=setup({usage:used,signal:abort.signal})
 await expect(controller.embed(["query"])).rejects.toThrow("reconciliation")
 expect(()=>controller.assertHealthy()).toThrow("reconciliation")
 await expect(controller.embed(["query"])).rejects.toThrow("reconciliation")
 expect(transport).toHaveBeenCalledOnce();expect(used.embeddingInput).toBeUndefined()
 await reconcileAiRun("run","answer-id")
 expect(rpc).toHaveBeenCalledWith("reconcile_workspace_ai_run",{p_id:"run",p_response_id:"answer-id"})
 expect(rpc.mock.calls.some(([name])=>name==="record_workspace_ai_result")).toBe(false)
})
it("retains confirmed cost for malformed vectors without claiming usage uncertainty",async()=>{
 const used=usage();transport.mockResolvedValueOnce({model:policy.model,inputTokens:2,vectors:[[NaN,0]]})
 const controller=setup({usage:used});await expect(controller.embed(["query"])).rejects.toThrow("Invalid document embeddings")
 expect(used.embeddingInput).toBe(2);expect(()=>controller.assertHealthy()).not.toThrow()
})


describe("processing-qualified admission configuration",()=>{
 it("keeps the live adapter unconfigured and does not derive activation from environment flags",()=>{
  vi.stubEnv("WORKSPACE_AI_DOCUMENT_EMBEDDING_ENABLED","1")
  try { expect(configuredDocumentEmbedding()).toBeUndefined(); expect(resolveDocumentEmbeddingConfig(base)).toEqual({config:base}) }
  finally { vi.unstubAllEnvs() }
 })
 it("requires explicit processing, tokenizer and on-demand policy before admission",()=>{
  const registration={policy:embeddingDisclosureFixture,transport,qualifiedSourceIds:new Set(["document:mission"])}
  const resolved=resolveDocumentEmbeddingConfig(base,registration)
  expect(resolved.config.tariff.embedding?.processing).toEqual(embeddingDisclosureFixture.processing)
  expect(resolved.documentEmbedding?.qualifiedSourceIds).not.toBe(registration.qualifiedSourceIds)
  for(const processing of [undefined,{...embeddingDisclosureFixture.processing,destination:""},{...embeddingDisclosureFixture.processing,qualification:""},
   {...embeddingDisclosureFixture.processing,tokenizerQualification:""},{...embeddingDisclosureFixture.processing,tokenBound:"guessed"},
   {...embeddingDisclosureFixture.processing,costPolicy:"background"}]) {
    expect(()=>resolveDocumentEmbeddingConfig(base,{...registration,policy:{...embeddingDisclosureFixture,processing} as typeof embeddingDisclosureFixture})).toThrow()
  }
  expect(transport).not.toHaveBeenCalled()
 })
 it("binds every disclosed processing term to the quote, even without a price change",()=>{
  const initial=withDocumentEmbeddingBudget(base,embeddingDisclosureFixture)
  for(const key of ["provider","destination","retention","training","qualification","tokenizerQualification"] as const) {
   const policy={...embeddingDisclosureFixture,processing:{...embeddingDisclosureFixture.processing,[key]:"changed"}}
   expect(withDocumentEmbeddingBudget(base,policy).tariff.version).not.toBe(initial.tariff.version)
  }
 })
 it("restores only the immutable saved disclosure and marks incomplete historical embedding terms unknown",()=>{
  const saved=withDocumentEmbeddingBudget(base,embeddingDisclosureFixture)
  expect(savedResearchProcessing(saved.tariff,saved.maxCredits)?.embedding).toEqual(embeddingDisclosureFixture)
  expect(savedResearchProcessing(config.tariff,config.maxCredits)).toMatchObject({embeddingUnavailable:true})
  expect(savedResearchProcessing(base.tariff,base.maxCredits)).not.toHaveProperty("embedding")
 })
})
