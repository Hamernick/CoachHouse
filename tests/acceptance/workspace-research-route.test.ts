import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context:vi.fn(), config:vi.fn(), reserve:vi.fn(), claim:vi.fn(), settle:vi.fn(), correlate:vi.fn(), reconcile:vi.fn(), read:vi.fn(), provider:vi.fn(), load:vi.fn(),file:vi.fn(),history:vi.fn(),account:vi.fn() }))
vi.mock("@/features/workspace-ai/server/knowledge-file",()=>({readKnowledgeFile:mocks.file}))
vi.mock("@/features/workspace-ai/server/knowledge-records",()=>({knowledgeLoader:()=>mocks.load}))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-ai/server/research-config",()=>({researchConfig:mocks.config}))
vi.mock("@/features/workspace-ai/server/research-provider",()=>({runResearchProvider:mocks.provider}))
vi.mock("@/features/ai-credits",async()=>({aiCreditBalance:(await import("@/features/ai-credits/lib")).aiCreditBalance,priceAiUsage:(await import("@/features/ai-credits/lib")).priceAiUsage,AiAdmissionDenied:(await import("@/features/ai-credits/server/admission-error")).AiAdmissionDenied,reserveAiRun:mocks.reserve,claimAiRun:mocks.claim,settleAiRun:mocks.settle,correlateAiResearchResponse:mocks.correlate,reconcileAiRun:mocks.reconcile,readAiRun:mocks.read,cancelAiRun:vi.fn(),readAiAccount:mocks.account,listAiResearchRuns:mocks.history}))
import { AiAdmissionDenied } from "@/features/ai-credits/server/admission-error"
import { knowledgeFingerprint, researchContextFingerprint } from "@/features/workspace-ai/server/research-dependencies"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import { getWorkspaceResearch, quoteWorkspaceResearch, listWorkspaceResearch } from "@/features/workspace-ai/research-actions"
import { researchProviderRequest } from "@/features/workspace-ai/server/research-provider-request"
import { researchPrompt } from "@/features/workspace-ai/server/research-prompt"
import { researchInstructions } from "@/features/workspace-ai/lib/research-skills"
import { researchRecovery } from "@/features/workspace-ai/lib/research-recovery"
import { researchSnapshotSchema } from "@/features/workspace-ai/lib/research-snapshot"
import { handleWorkspaceResearch, readResearchRun } from "@/features/workspace-ai/server/research-run"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
const target={organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
const input={id:ID(2),target,prompt:"Develop this objective",skill:"planning" as const,tariffVersion:"test",maximumCredits:20}
const request=(value:unknown=input,origin="http://localhost:3008")=>new Request("http://localhost:3008/api/workspace-ai/research",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(value)})
beforeEach(()=>{
 vi.resetAllMocks()
 vi.unstubAllEnvs()
 mocks.load.mockResolvedValue([])
 mocks.account.mockResolvedValue({enabled:true,paymentReview:false,lots:[]})
 mocks.context.mockResolvedValue({user:{id:ID(90)},canvasId:null,graph:graph(),objective:particle(1,"objective"),target})
 mocks.config.mockReturnValue({tariff:{version:"test",model:"fixture"},maxRounds:3,maxOutputTokens:1500,maxCredits:20,maxCost:40000,maxInputBytes:20000})
 mocks.reserve.mockResolvedValue({created:true});mocks.claim.mockResolvedValue(true)
 mocks.settle.mockResolvedValue(null);mocks.reconcile.mockResolvedValue(null)
 mocks.provider.mockResolvedValue({canceled:false,result:null,responseId:"response",usage:{input:10,cachedInput:0,output:2}})
 mocks.read.mockResolvedValue({id:ID(2),status:"failed",target:{...target,kind:"particle_research"},proposal:null,charged_credits:0,cancel_requested_at:null})
})
describe("opt-in research progress transport",()=>{
 const streamingRequest=()=>{const value=request();value.headers.set("Accept","text/event-stream, application/json");return value}
 it.each(["allowed","revoked","changed","stopped","lookup failed"])("reauthorizes unsaved previews before disclosure: %s", async outcome => {
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  const context=await mocks.context()
  const candidate:ResearchResult={runId:input.id,target,title:"Private candidate",summary:"",questions:[],sources:[],items:[],
   dependencies:{version:1,contextFingerprint:researchContextFingerprint(context),records:[]}}
  mocks.provider.mockResolvedValue({canceled:false,result:candidate,responseId:"response",usage:{input:10,cachedInput:0,output:2}})
  mocks.context.mockResolvedValueOnce(context)
  if(outcome==="revoked") mocks.context.mockRejectedValueOnce(new Error("private access denial"))
  else if(outcome==="changed") mocks.context.mockResolvedValueOnce({...context,objective:{...context.objective,title:"Changed"}})
  const running={id:input.id,status:"running",target:{...target,kind:"particle_research"},proposal:null,charged_credits:null,cancel_requested_at:outcome==="stopped"?"2026-10-31T12:00:00Z":null}
  if(outcome==="lookup failed") mocks.read.mockRejectedValueOnce(new Error("private ledger failure"))
  else if(!["revoked","changed"].includes(outcome)) mocks.read.mockResolvedValueOnce(running)
  mocks.read.mockResolvedValue({ ...running,status:"succeeded",proposal:JSON.stringify(candidate) })
  const wire=await (await handleWorkspaceResearch(streamingRequest())).text()
  expect(wire.includes('"preview.updated"')).toBe(outcome==="allowed")
  const previewFrame=wire.split("\n\n").find(frame=>frame.includes('"preview.updated"'))
  expect((previewFrame ?? "").includes("Private candidate")).toBe(outcome==="allowed")
  expect(previewFrame ?? "").not.toContain("contextFingerprint")
  // A later authorized durable read is independent of the optional preview.
  expect(wire).toContain('"run.snapshot"')
  expect(wire).not.toContain("private access denial");expect(wire).not.toContain("private ledger failure")
  expect(mocks.settle).toHaveBeenCalledTimes(1);expect(mocks.provider).toHaveBeenCalledTimes(1)
  expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it("withholds the final snapshot when source authorization fails after settlement",async()=>{
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  const context=await mocks.context()
  mocks.context.mockResolvedValueOnce(context).mockRejectedValue(new Error("private revoked source"))
  const wire=await (await handleWorkspaceResearch(streamingRequest())).text()
  expect(wire).not.toContain('"run.snapshot"');expect(wire).not.toContain("private revoked source")
  expect(wire).toContain('"recovering"');expect(mocks.settle).toHaveBeenCalledTimes(1)
 })
 it("preserves JSON unless server-side qualification is enabled",async()=>{
  expect((await handleWorkspaceResearch(streamingRequest())).headers.get("content-type")).toContain("application/json")
 })
 it("does not advertise an unsaved preview as ready when settlement fails",async()=>{
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  const context=await mocks.context()
  const candidate:ResearchResult={runId:input.id,target,title:"Unsaved candidate",summary:"",questions:[],sources:[],items:[],
   dependencies:{version:1,contextFingerprint:researchContextFingerprint(context),records:[]}}
  mocks.provider.mockResolvedValue({canceled:false,result:candidate,responseId:"response",usage:{input:10,cachedInput:0,output:2}})
  mocks.read.mockResolvedValue({id:input.id,status:"running",target:{...target,kind:"particle_research"},proposal:null,charged_credits:null,cancel_requested_at:null})
  mocks.settle.mockRejectedValue(new Error("private settlement failure"))
  const wire=await (await handleWorkspaceResearch(streamingRequest())).text()
  expect(wire).toContain('"preview.updated"');expect(wire).toContain('"phase":"recovering"')
  expect(wire).not.toContain('"result.ready"');expect(wire).not.toContain('"run.terminal"')
  expect(wire).not.toContain("private settlement failure")
  expect(mocks.reconcile).toHaveBeenCalledTimes(1);expect(mocks.provider).toHaveBeenCalledTimes(1)
 })
 it("keeps admission failures outside an admitted stream",async()=>{
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  mocks.reserve.mockRejectedValue(new AiAdmissionDenied("credits_unavailable","private"))
  const response=await handleWorkspaceResearch(streamingRequest())
  expect(response.status).toBe(409)
  expect(response.headers.get("content-type")).toContain("application/json")
  expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("streams only after admission and emits terminal status after settlement/readback",async()=>{
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  mocks.provider.mockImplementation(async({onPhase})=>{
   expect(mocks.claim).toHaveBeenCalledTimes(1)
   onPhase("reading")
   return {canceled:false,result:null,responseId:"response",usage:{input:10,cachedInput:0,output:2}}
  })
  const response=await handleWorkspaceResearch(streamingRequest())
  expect(response.headers.get("content-type")).toContain("text/event-stream")
  const text=await response.text()
  expect(text).toContain('"phase":"reading"');expect(text).toContain('"RUN_ERROR"')
  expect(text).not.toContain(input.prompt)
  expect(mocks.settle).toHaveBeenCalledTimes(1);expect(mocks.read).toHaveBeenCalledTimes(1)
  expect(mocks.settle.mock.invocationCallOrder[0]).toBeLessThan(mocks.read.mock.invocationCallOrder[0])
 })
 it("keeps interrupted generation recoverable without false terminal status",async()=>{
  vi.stubEnv("WORKSPACE_AI_PROGRESS_STREAM","1")
  mocks.provider.mockRejectedValue(new Error("private provider error"))
  const text=await (await handleWorkspaceResearch(streamingRequest())).text()
  expect(text).toContain('"phase":"recovering"')
  expect(text).not.toContain("private provider error");expect(text).not.toContain("run.terminal")
  expect(mocks.reconcile).toHaveBeenCalledWith(input.id,null)
  expect(mocks.reserve).toHaveBeenCalledTimes(1);expect(mocks.provider).toHaveBeenCalledTimes(1)
 })
})
describe("complete request admission capacity", () => {
 it("rejects schema overhead before quoting or reserving, even when the prompt alone fits", async () => {
  const context = await mocks.context(), config = mocks.config()
  const promptOnlyBytes = Buffer.byteLength(JSON.stringify([{role:"user",content:researchPrompt(context, input)}]) + researchInstructions)
  mocks.config.mockReturnValue({...config,maxInputBytes:promptOnlyBytes})
  expect(await quoteWorkspaceResearch(target)).toEqual({error:researchRecovery.context_too_large.message,failure:{code:"context_too_large"}})
  expect(mocks.account).not.toHaveBeenCalled()
  expect(await (await handleWorkspaceResearch(request())).json()).toEqual({error:researchRecovery.context_too_large.message,failure:{code:"context_too_large"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.claim).not.toHaveBeenCalled()
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it("rechecks the actual Unicode request after a context-only quote", async () => {
  const context = await mocks.context(), config = mocks.config()
  const quoteBytes = Buffer.byteLength(JSON.stringify(researchProviderRequest(config,[{role:"user",content:researchPrompt(context,{...input,prompt:""})}])))
  mocks.config.mockReturnValue({...config,maxInputBytes:quoteBytes + 1000})
  expect(await quoteWorkspaceResearch(target)).toEqual({maximumCredits:20,tariffVersion:"test",provider:"OpenAI",model:"fixture",availableCredits:0})
  expect(await (await handleWorkspaceResearch(request({...input,prompt:"界".repeat(1000)}))).json()).toMatchObject({failure:{code:"context_too_large"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it.each([0,-1])("handles the complete request byte boundary (%s)", async delta => {
  const context = await mocks.context(), config = mocks.config()
  const bytes = Buffer.byteLength(JSON.stringify(researchProviderRequest(config,[{role:"user",content:researchPrompt(context,input)}])))
  mocks.config.mockReturnValue({...config,maxInputBytes:bytes + delta})
  const response = await handleWorkspaceResearch(request())
  expect(response.status).toBe(delta === 0 ? 200 : 400)
  expect(mocks.reserve).toHaveBeenCalledTimes(delta === 0 ? 1 : 0)
  expect(mocks.provider).toHaveBeenCalledTimes(delta === 0 ? 1 : 0)
 })
})

describe("research request boundary",()=>{
 it("rejects a foreign origin before reading data or reserving credits",async()=>{
  expect((await handleWorkspaceResearch(request(input,"https://outside.example"))).status).toBe(403)
  expect(mocks.context).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled()
 })
 it("does not spend or call a provider when authorization fails",async()=>{
  mocks.context.mockRejectedValue(new Error("Access denied"))
  expect((await handleWorkspaceResearch(request())).status).toBe(400)
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("rejects changed quotes before spending",async()=>{
  expect((await handleWorkspaceResearch(request({...input,maximumCredits:1}))).status).toBe(400)
  expect(mocks.reserve).not.toHaveBeenCalled()
 })
 it.each(["context","config"] as const)("redacts %s admission exceptions before any reservation",async source=>{
  mocks[source].mockImplementation(()=>{throw new Error("private-email@example.org / database credentials")})
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toEqual({error:researchRecovery.admission_unavailable.message,failure:{code:"admission_unavailable"},reserved:false})
  expect(await quoteWorkspaceResearch(target)).toEqual({error:researchRecovery.admission_unavailable.message,failure:{code:"admission_unavailable"}})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it.each(["malformed","schema","oversized"])("rejects %s input with fixed guidance before context access",async kind=>{
  const body=kind==="malformed"?"{private invalid body":JSON.stringify(kind==="oversized"?{...input,prompt:"x".repeat(12001)}:{...input,prompt:undefined})
  const response=await handleWorkspaceResearch(new Request("http://localhost:3008/api/workspace-ai/research",{method:"POST",headers:{origin:"http://localhost:3008"},body}))
  expect(await response.json()).toEqual({error:researchRecovery.invalid_request.message,failure:{code:"invalid_request"},reserved:false})
  expect(mocks.context).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled()
 })
 it("requires renewed quote review without reserving at a changed price",async()=>{
  const response=await handleWorkspaceResearch(request({...input,tariffVersion:"old"}))
  expect(await response.json()).toEqual({error:researchRecovery.pricing_changed.message,failure:{code:"pricing_changed"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it.each(["credits_unavailable","usage_limit","capacity_busy","ai_disabled"] as const)("reports confirmed %s rejection without a recoverable run",async reason=>{
  mocks.reserve.mockRejectedValue(new AiAdmissionDenied(reason,"Private ledger detail"))
  const response=await handleWorkspaceResearch(request())
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({error:researchRecovery[reason].message,failure:{code:reason},reserved:false})
  expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
  expect(mocks.settle).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled()
 })
 it("retains an uncertain reservation for same-run recovery without claiming or settling",async()=>{
  mocks.reserve.mockRejectedValueOnce(new Error("Lost response after database commit, private ledger detail"))
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toEqual({error:researchRecovery.reservation_uncertain.message,failure:{code:"reservation_uncertain"},reserved:true})
  mocks.read.mockResolvedValueOnce({id:input.id,status:"reserved",target:{...target,kind:"particle_research"},proposal:null,charged_credits:0,cancel_requested_at:null})
  expect(await getWorkspaceResearch(input.id,target)).toMatchObject({run:{id:input.id,status:"reserved",result:null}})
  expect(mocks.reserve).toHaveBeenCalledTimes(1)
  expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
  expect(mocks.settle).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it.each(["claim","settle"] as const)("keeps confirmed reservation after %s failure even if reconciliation fails",async source=>{
  mocks[source].mockRejectedValueOnce(new Error("private ledger details"))
  mocks.reconcile.mockRejectedValueOnce(new Error("private reconciliation details"))
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toEqual({error:researchRecovery.run_interrupted.message,failure:{code:"run_interrupted"},reserved:true})
  expect(mocks.reconcile).toHaveBeenCalledWith(input.id,null)
  expect(mocks.reserve).toHaveBeenCalledTimes(1)
 })
 it("returns a duplicate run without repeating the provider call",async()=>{
  mocks.reserve.mockResolvedValue({created:false})
  expect((await handleWorkspaceResearch(request())).status).toBe(200)
  expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("reserves with the authenticated actor and settles measured failures",async()=>{
  expect((await handleWorkspaceResearch(request())).status).toBe(200)
  expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({actorId:ID(90),task:"research",target:expect.objectContaining({userId:ID(90)})}))
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"failed",proposal:null,usage:{input:10,cachedInput:0,output:2}}))
 })
 it("leaves interrupted reservations recoverable without replaying",async()=>{
  mocks.provider.mockImplementation(async ({onResponse})=>{await onResponse("unexpected-search-response");throw new Error("Unexpected external research activity")})
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toMatchObject({reserved:true})
  expect(mocks.reconcile).toHaveBeenCalledWith(ID(2),"unexpected-search-response")
  expect(mocks.provider).toHaveBeenCalledTimes(1);expect(mocks.settle).not.toHaveBeenCalled()
 })
 it.each([false,true])("retains timeout recovery with response correlation=%s and no guessed settlement",async correlated=>{
  mocks.provider.mockImplementation(async ({onResponse})=>{
   if(correlated) await onResponse("timeout-response")
   throw new DOMException("Private source and provider details","TimeoutError")
  })
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toEqual({error:researchRecovery.run_interrupted.message,failure:{code:"run_interrupted"},reserved:true})
  expect(mocks.reconcile).toHaveBeenCalledWith(input.id,correlated?"timeout-response":null)
  expect(mocks.provider).toHaveBeenCalledTimes(1)
  expect(mocks.settle).not.toHaveBeenCalled()
 })
 it("settles observed cancellation with measured usage and no proposal",async()=>{
  mocks.provider.mockResolvedValueOnce({canceled:true,result:null,responseId:"response",usage:{input:100,cachedInput:10,output:20}})
  mocks.read.mockResolvedValueOnce({id:input.id,status:"canceled",target:{...target,kind:"particle_research"},proposal:null,charged_credits:0,cancel_requested_at:"2026-10-30T12:00:00Z"})
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toMatchObject({run:{status:"canceled",result:null,credits:0}})
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"canceled",usage:{input:100,cachedInput:10,output:20},proposal:null,responseId:"response"}))
  expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it("settles an unclaimed canceled request without a provider call",async()=>{
  mocks.claim.mockResolvedValue(false)
  await handleWorkspaceResearch(request())
  expect(mocks.provider).not.toHaveBeenCalled()
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"canceled",usage:{input:0,cachedInput:0,output:0}}))
 })
})

describe("revision request and recovery",()=>{
 it("rejects oversized selected-plan context before reserving credits",async()=>{
  mocks.config.mockReturnValue({tariff:{version:"test"},maxCredits:20,maxCost:40000,maxInputBytes:30})
  const response=await handleWorkspaceResearch(request())
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({reserved:false,error:expect.stringMatching(/too large/)})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("binds plan identity and revision into the reservation and recovers it privately",async()=>{
  const revised={...target,plan:{id:ID(50),revision:2}},objective=particle(1,"objective")
  if(objective.type!=="objective")throw Error()
  objective.data.planning={plans:[{id:ID(50),revision:2,title:"Current",particleIds:[]}],proposals:[]}
  mocks.context.mockResolvedValue({user:{id:ID(90)},canvasId:null,graph:graph([objective]),objective,target:revised})
  mocks.read.mockResolvedValue({id:ID(2),status:"failed",target:{...revised,kind:"particle_research",userId:ID(90),canvasId:null},proposal:null,charged_credits:0,cancel_requested_at:null})
  expect((await handleWorkspaceResearch(request({...input,target:revised}))).status).toBe(200)
  expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({target:expect.objectContaining({plan:revised.plan})}))
  expect((await readResearchRun(ID(2),revised)).id).toBe(ID(2))
  expect(mocks.context).toHaveBeenLastCalledWith(revised,false)
  await expect(readResearchRun(ID(2),{...revised,plan:{id:ID(51),revision:2}})).rejects.toThrow()
  expect((await readResearchRun(ID(2),{...revised,revision:10,plan:{id:ID(50),revision:3}})).id).toBe(ID(2))
  await expect(readResearchRun(ID(2),target)).rejects.toThrow()
 })
})


describe("saved research disclosure", () => {
 const source = {id:`person:${ID(20)}`,title:"Private contact",href:"/workspace",revision:"v1",kind:"workspace" as const,checkedAt:"2026-10-30T12:00:00.000Z"}
 const record = {id:source.id,kind:"person" as const,title:source.title,content:"Private details",href:"/workspace",revision:"v1",contentAvailable:true}
 const initial = {user:{id:ID(90)},canvasId:null,graph:graph(),objective:particle(1,"objective"),target} as ResearchContext
 const saved = (): ResearchResult => ({dependencies:{version:1,contextFingerprint:researchContextFingerprint(initial),records:[{id:record.id,kind:record.kind,fingerprint:knowledgeFingerprint(record)}]},runId:ID(2),target,title:"Private result",summary:"Contact details derived from evidence",questions:[],items:[],sources:[source]})
 const setRun = (result=saved()) => mocks.read.mockResolvedValue({id:ID(2),status:"succeeded",target:{...target,kind:"particle_research",userId:ID(90),canvasId:null},proposal:JSON.stringify(result),charged_credits:2,cancel_requested_at:null})
 it("reopens only after exact-ID source checks and preserves historical evidence", async () => {
  setRun();mocks.load.mockResolvedValue([record])
  expect(await readResearchRun(ID(2),target)).toMatchObject({ version: 1, result: saved(), resultRevision: 1, applicability: "review_required" })
  expect(mocks.load).toHaveBeenCalledWith("person","",source.id)
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled()
 })
 it.each(["revoked","changed","foreign","unknown"])("withholds all derived content for %s evidence",async kind => {
  const value=saved()
  if(kind==="unknown")value.sources[0]={...source,id:"unsupported:private"}
  setRun(value)
  if(kind==="changed")mocks.load.mockResolvedValue([{...record,revision:"v2"}])
  if(kind==="foreign")mocks.load.mockResolvedValue([{...record,id:`person:${ID(21)}`}])
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/^A research source changed or is no longer accessible/)
  expect(mocks.settle).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("retries a failed source reader on the same run without regeneration or billing",async()=>{
  setRun();mocks.load.mockRejectedValueOnce(new Error("Private contact email and database detail")).mockResolvedValue([record])
  expect(await getWorkspaceResearch(ID(2),target)).toEqual({error:researchRecovery.verification_unavailable.message,failure:{code:"verification_unavailable"}})
  const recovered=await getWorkspaceResearch(ID(2),target)
  expect(recovered).toMatchObject({run:{id:ID(2),status:"succeeded",result:saved()}})
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled()
 })
 it("keeps duplicate-request verification failures attached to their existing reservation",async()=>{
  setRun();mocks.reserve.mockResolvedValue({created:false});mocks.load.mockRejectedValue(new Error("Private reader error"))
  const response=await handleWorkspaceResearch(request())
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({error:researchRecovery.verification_unavailable.message,failure:{code:"verification_unavailable"},reserved:true})
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it("masks unexpected context and ledger errors without claiming permanent revocation",async()=>{
  for(const reader of [mocks.context,mocks.read]) {
   reader.mockRejectedValueOnce(new Error("Private actor, database, or storage information"))
   expect(await getWorkspaceResearch(ID(2),target)).toEqual({error:researchRecovery.verification_unavailable.message,failure:{code:"verification_unavailable"}})
  }
 })
 it.each([null,"not json",JSON.stringify({summary:"Private invalid content"})])("offers discard for malformed successful saved results (%s)",async proposal=>{
  setRun();mocks.read.mockResolvedValue({...await mocks.read(),proposal})
  expect(await getWorkspaceResearch(ID(2),target)).toEqual({error:researchRecovery.invalid_result.message,failure:{code:"invalid_result"}})
  expect(mocks.load).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("returns typed discard guidance for historical and foreign-scope results",async()=>{
  const value=saved();delete value.dependencies;setRun(value)
  expect(await getWorkspaceResearch(ID(2),target)).toEqual({error:researchRecovery.legacy_result.message,failure:{code:"legacy_result"}})
  setRun()
  expect(await getWorkspaceResearch(ID(2),{...target,objectiveId:ID(99)})).toEqual({error:researchRecovery.scope_mismatch.message,failure:{code:"scope_mismatch"}})
  expect(mocks.load).not.toHaveBeenCalled()
 })
 it("does not reuse access from a prior reopen",async()=>{
  setRun();mocks.load.mockResolvedValue([record])
  await readResearchRun(ID(2),target)
  mocks.load.mockResolvedValue([])
 mocks.account.mockResolvedValue({enabled:true,paymentReview:false,lots:[]})
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/source changed/)
 })
 it("does not leak a saved result through duplicate-request recovery",async()=>{
  setRun();mocks.reserve.mockResolvedValue({created:false})
  const response=await handleWorkspaceResearch(request())
  expect(response.status).toBe(409)
  const body=await response.json()
  expect(body).toMatchObject({reserved:true,failure:{code:"sources_changed"}})
  expect(body).not.toHaveProperty("run")
  expect(JSON.stringify(body)).not.toContain("Contact details")
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled()
 })
 it("withholds historical results without dependency tracking",async()=>{
  const value=saved();delete value.dependencies;setRun(value)
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/predates complete access tracking/)
  expect(mocks.load).not.toHaveBeenCalled()
 })
 it("withholds uncited inputs even with no visible citations",async()=>{
  const value=saved();value.sources=[];setRun(value)
  mocks.load.mockResolvedValue([record])
  expect((await readResearchRun(ID(2),target)).result?.sources).toEqual([])
  mocks.load.mockResolvedValue([])
 mocks.account.mockResolvedValue({enabled:true,paymentReview:false,lots:[]})
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/source changed/)
 })
 it("detects changed content even when revisions are null or unchanged",async()=>{
  const original={...record,revision:null},value=saved()
  value.sources=[];value.dependencies!.records[0].fingerprint=knowledgeFingerprint(original);setRun(value)
  mocks.load.mockResolvedValue([original])
  await readResearchRun(ID(2),target)
  mocks.load.mockResolvedValue([{...original,content:"Changed private details"}])
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/source changed/)
 })
 it("withholds results when initial objective context changes without a revision bump",async()=>{
  setRun();mocks.load.mockResolvedValue([record])
  mocks.context.mockResolvedValue({...initial,objective:{...initial.objective,description:"Changed purpose"}})
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/source changed/)
  expect(mocks.load).not.toHaveBeenCalled()
 })
 it("rechecks extracted file content, not only its unchanged metadata",async()=>{
  const file={...record,id:`file:${ID(22)}`,kind:"document" as const,content:"File metadata",contentAvailable:false}
  const detail={...file,content:"Private document body",contentAvailable:true},value=saved()
  value.sources=[];value.dependencies!.records=[{id:file.id,kind:file.kind,fingerprint:knowledgeFingerprint(file),detailFingerprint:knowledgeFingerprint(detail)}]
  setRun(value);mocks.load.mockResolvedValue([file]);mocks.file.mockResolvedValue(detail)
  await readResearchRun(ID(2),target)
  mocks.file.mockResolvedValue({...detail,content:"Replaced body"})
  await expect(readResearchRun(ID(2),target)).rejects.toThrow(/source changed/)
  mocks.file.mockRejectedValue(Error("Private storage path"))
  await expect(readResearchRun(ID(2),target)).rejects.toMatchObject({code:"verification_unavailable"})
  expect(mocks.file).toHaveBeenCalledTimes(3)
 })
 it.each(["runId","revision","objectiveId","organizationId","plan"])("rejects saved %s provenance mismatch before source access",async field=>{
  const value=saved()
  if(field==="runId")value.runId=ID(99)
  else if(field==="revision")value.target={...target,revision:1}
  else if(field==="plan")Object.assign(value,{target:{...target,plan:{id:ID(50),revision:0}}})
  else value.target={...target,[field]:ID(99)}
  setRun(value)
  await expect(readResearchRun(ID(2),target)).rejects.toMatchObject({code:"invalid_result"})
  expect(mocks.load).not.toHaveBeenCalled()
 })
})


describe("previous research discovery",()=>{
 beforeEach(()=>{
  mocks.context.mockResolvedValue({user:{id:ID(90)},activeOrg:{orgId:WORKSPACE},canvasId:"canvas-a",objective:particle(1,"objective")})
  mocks.history.mockResolvedValue([{id:ID(2),status:"succeeded",created_at:"2026-10-30T10:00:00+00:00"}])
 })
 it("uses verified actor/canvas/objective scope and returns only bounded metadata",async()=>{
  const selection={...target,plan:{id:ID(50),revision:2}}
  expect(await listWorkspaceResearch(selection)).toEqual({runs:[{id:ID(2),status:"succeeded",created_at:"2026-10-30T10:00:00+00:00"}]})
  expect(mocks.context).toHaveBeenCalledWith(selection,false)
  expect(mocks.history).toHaveBeenCalledWith({organizationId:WORKSPACE,actorId:ID(90),objectiveId:ID(1),canvasId:"canvas-a",planId:ID(50)})
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled()
 })
 it("keeps new-plan history separate from selected-plan history",async()=>{
  await listWorkspaceResearch(target)
  expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({planId:null}))
 })
 it("rejects revoked context before discovery without leaking diagnostics",async()=>{
  mocks.context.mockRejectedValue(new Error("private permission detail"))
  expect(await listWorkspaceResearch(target)).toEqual({error:"Previous research could not be loaded. Try again."})
  expect(mocks.history).not.toHaveBeenCalled()
 })
 it.each([null,Array.from({length:13},()=>({id:ID(2),status:"succeeded",created_at:"2026-10-30T10:00:00Z"})),[{id:ID(2),status:"succeeded",created_at:"2026-10-30T10:00:00Z",prompt:"private"}],[{id:ID(2),status:"unknown",created_at:"invalid"}]].map(rows=>({rows})))("fails closed on malformed history $rows",async ({rows})=>{
  mocks.history.mockResolvedValue(rows)
  expect(await listWorkspaceResearch(target)).toEqual({error:"Previous research could not be loaded. Try again."})
 })
 it("does not expose database failures",async()=>{
  mocks.history.mockRejectedValue(new Error("private database detail"))
  expect(await listWorkspaceResearch(target)).toEqual({error:"Previous research could not be loaded. Try again."})
 })
})


describe("new objective request and recovery", () => {
 const newTarget = {mode:"new_objective" as const,organizationId:WORKSPACE,canvasId:null,revision:0}
 function setup() {
  const context={user:{id:ID(90)},activeOrg:{orgId:WORKSPACE},canvasId:null,graph:graph([]),target:newTarget}
  mocks.context.mockResolvedValue(context)
  mocks.read.mockResolvedValue({id:ID(2),status:"failed",target:{...newTarget,kind:"particle_research",userId:ID(90)},proposal:null,charged_credits:0,cancel_requested_at:null})
  return context
 }
 it("reserves exactly the server actor and canvas without a persisted objective",async()=>{
  setup()
  const response=await handleWorkspaceResearch(request({...input,target:newTarget}))
  expect(response.status).toBe(200)
  expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({task:"research",actorId:ID(90),target:{...newTarget,kind:"particle_research",userId:ID(90)}}))
  expect(mocks.provider).toHaveBeenCalledTimes(1)
 })
 it("rejects a fake placeholder ID before any reservation",async()=>{
  setup()
  const response=await handleWorkspaceResearch(request({...input,target:{...newTarget,objectiveId:ID(1)}}))
  expect(response.status).toBe(400);expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("rejects new versus existing and different-canvas recovery",async()=>{
  setup()
  await expect(readResearchRun(ID(2),target)).rejects.toThrow()
  await expect(readResearchRun(ID(2),{...newTarget,canvasId:ID(50)})).rejects.toThrow()
 })
 it("discovers run metadata scoped to actor and canvas without an objective",async()=>{
  setup();mocks.history.mockResolvedValue([])
  expect(await listWorkspaceResearch(newTarget)).toEqual({runs:[]})
  expect(mocks.history).toHaveBeenCalledWith({organizationId:WORKSPACE,actorId:ID(90),objectiveId:null,canvasId:null,planId:null})
 })
 it("recovers a confirmed application receipt without returning generated content or repeating work",async()=>{
  const context=setup(),objective=particle(99,"objective")
  if(objective.type!=="objective")throw Error()
  objective.data.planning={plans:[],proposals:[{id:ID(100),planId:ID(101),baseRevision:null,title:"Saved proposal",particleIds:[],authorId:ID(90),createdAt:"2026-10-30T10:00:00Z",status:"pending",researchRunId:ID(2)}]}
  mocks.context.mockResolvedValue({...context,graph:graph([objective])})
  mocks.read.mockResolvedValue({id:ID(2),status:"succeeded",target:{...newTarget,kind:"particle_research",userId:ID(90)},proposal:"private saved output",charged_credits:2,cancel_requested_at:null})
  expect(await readResearchRun(ID(2),newTarget)).toEqual({version:1,id:ID(2),status:"succeeded",credits:2,result:null,appliedObjectiveId:ID(99),resultRevision:1,applicability:"already_applied"})
  expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled()
 })
})

describe("durable research snapshot boundary", () => {
const result = { runId: ID(2), target: { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 },
  title: "Plan", summary: "", questions: [], items: [], sources: [] }
const snapshot = { version: 1, id: ID(2), status: "succeeded", credits: 2, result, resultRevision: 1, applicability: "review_required" }


  it("accepts saved success or its separate application receipt", () => {
    expect(researchSnapshotSchema.parse(snapshot)).toEqual(snapshot)
    const receipt = { ...snapshot, result: null, appliedObjectiveId: ID(3), applicability: "already_applied" }
    expect(researchSnapshotSchema.parse(receipt)).toEqual(receipt)
  })
  it.each(["reserved", "running", "reconciling", "failed", "canceled"])("withholds results and receipts for %s", status => {
    expect(researchSnapshotSchema.safeParse({ ...snapshot, status, result: null, resultRevision: null, applicability: "unavailable" }).success).toBe(true)
    expect(researchSnapshotSchema.safeParse({ ...snapshot, status }).success).toBe(false)
    expect(researchSnapshotSchema.safeParse({ ...snapshot, status, result: null, appliedObjectiveId: ID(3) }).success).toBe(false)
  })
  it.each([
    { result: null }, { appliedObjectiveId: ID(3) }, { id: ID(4) }, { status: "complete" },
    { result: { ...result, items: [{ title: "Incomplete item" }] } },
    { credits: -1 }, { credits: "2" }, { resultRevision: 123 },
    { resultRevision: 0 }, { resultRevision: null }, { resultRevision: undefined },
    { version: 2 }, { version: undefined }, { applicability: "already_applied" },
    { applicability: "unavailable" }, { applicability: "apply" },
  ])("rejects inconsistent or malformed snapshots: %j", patch => {
    expect(researchSnapshotSchema.safeParse({ ...snapshot, ...patch }).success).toBe(false)
  })
})

describe("reviewed public brief admission and recovery",()=>{
 const publicResearch={version:1 as const,destination:"openai_web_search" as const,brief:"Public community garden planning",approved:true as const}
 it("quotes only the exact reviewed public intent and hashes it into the existing reservation",async()=>{
  const base=mocks.config();mocks.config.mockReturnValue({...base,maxSearchCalls:1,publicResearchAvailable:true})
  expect(await quoteWorkspaceResearch(target,publicResearch)).toMatchObject({maximumCredits:20,publicResearchAvailable:true})
  expect(mocks.config).toHaveBeenLastCalledWith(publicResearch)
  await handleWorkspaceResearch(request({...input,publicResearch}))
  expect(mocks.provider.mock.calls[0][0].request.publicResearch).toEqual(publicResearch)
  const first=mocks.reserve.mock.calls[0][0].hash
  await handleWorkspaceResearch(request({...input,publicResearch:{...publicResearch,brief:"Different exact approved public brief"}}))
  expect(mocks.reserve.mock.calls[1][0].hash).not.toBe(first)
  expect(mocks.reserve.mock.calls[0][0]).toMatchObject({id:input.id,actorId:ID(90),organizationId:WORKSPACE})
 })
 it("rejects model-purpose consent, stale public quotes and malformed destination before reservation",async()=>{
  for(const publicResearchValue of [{...publicResearch,approved:false},{...publicResearch,purpose:"safe"},{...publicResearch,destination:"unapproved"}]) expect((await handleWorkspaceResearch(request({...input,publicResearch:publicResearchValue}))).status).toBe(400)
  const base=mocks.config();mocks.config.mockReturnValue({...base,tariff:{...base.tariff,version:"changed-explicit-search-price"}})
  expect(await (await handleWorkspaceResearch(request({...input,publicResearch}))).json()).toMatchObject({failure:{code:"pricing_changed"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("retains interrupted public effects under existing response correlation without replay or false zero-cost settlement",async()=>{
  mocks.provider.mockImplementation(async hooks=>{await hooks.onResponse("public-response");throw new Error("unknown search usage")})
  const response=await handleWorkspaceResearch(request({...input,publicResearch}))
  expect((await response.json()).reserved).toBe(true)
  expect(mocks.correlate).toHaveBeenCalledWith(input.id,"public-response")
  expect(mocks.reconcile).toHaveBeenCalledWith(input.id,"public-response");expect(mocks.settle).not.toHaveBeenCalled()
  mocks.reserve.mockResolvedValue({created:false})
  await handleWorkspaceResearch(request({...input,publicResearch}))
  expect(mocks.provider).toHaveBeenCalledTimes(1)
 })
})


describe("quoted model and durable research receipt",()=>{
 it("binds the exact model even when operator version and maximum charge are unchanged",async()=>{
  const {researchConfig}=await vi.importActual<typeof import("@/features/workspace-ai/server/research-config")>("@/features/workspace-ai/server/research-config")
  vi.stubEnv("WORKSPACE_AI_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","fixture-only")
  const rate={version:"operator-unchanged",model:"fixture-model-a",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000}
  vi.stubEnv("WORKSPACE_AI_RATE_CARD",JSON.stringify(rate))
  const approved=researchConfig();expect(researchConfig()).toEqual(approved)
  vi.stubEnv("WORKSPACE_AI_RATE_CARD",JSON.stringify({...rate,model:"fixture-model-b"}))
  const current=researchConfig();expect(current.maxCredits).toBe(approved.maxCredits);expect(current.tariff.version).not.toBe(approved.tariff.version)
  mocks.config.mockReturnValue(current)
  const response=await handleWorkspaceResearch(request({...input,tariffVersion:approved.tariff.version,maximumCredits:approved.maxCredits}))
  expect(await response.json()).toMatchObject({failure:{code:"pricing_changed"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("requires a new quote when the completed-source contract adds linked Sheet composition",async()=>{
  const {researchConfig}=await vi.importActual<typeof import("@/features/workspace-ai/server/research-config")>("@/features/workspace-ai/server/research-config")
  vi.stubEnv("WORKSPACE_AI_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","fixture-only")
  vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS","0");vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS","1");vi.stubEnv("NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION","1")
  const tariff={version:"operator-unchanged",model:"fixture-model",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000}
  vi.stubEnv("WORKSPACE_AI_RATE_CARD",JSON.stringify(tariff))
  const previous=`private-${createHash("sha256").update(JSON.stringify({tariff,contract:"research-v15-existing-views",forms:false,views:true})).digest("hex").slice(0,40)}`
  const current=researchConfig();expect(current.tariff.version).not.toBe(previous);mocks.config.mockReturnValue(current)
  const response=await handleWorkspaceResearch(request({...input,tariffVersion:previous,maximumCredits:current.maxCredits}))
  expect(await response.json()).toMatchObject({failure:{code:"pricing_changed"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("requires a fresh quote for concrete drafts even when model, bounds and charge are unchanged",async()=>{
  const {researchConfig}=await vi.importActual<typeof import("@/features/workspace-ai/server/research-config")>("@/features/workspace-ai/server/research-config")
  vi.stubEnv("WORKSPACE_AI_ENABLED","true");vi.stubEnv("OPENAI_API_KEY","fixture-only")
  vi.stubEnv("WORKSPACE_AI_FORM_OUTPUTS","0");vi.stubEnv("WORKSPACE_AI_DATA_VIEW_OUTPUTS","0")
  const tariff={version:"operator-unchanged",model:"fixture-model",inputMicrodollarsPerMillion:1,cachedMicrodollarsPerMillion:0,outputMicrodollarsPerMillion:1,microdollarsPerCredit:2000}
  vi.stubEnv("WORKSPACE_AI_RATE_CARD",JSON.stringify(tariff))
  const current=researchConfig()
  const previous=`private-${createHash("sha256").update(JSON.stringify({tariff,contract:"research-v16-linked-sheet-views",forms:false,views:false,bounds:{maxRounds:3,maxOutputTokens:3000,maxInputBytes:20000}})).digest("hex").slice(0,40)}`
  mocks.config.mockReturnValue(current)
  const response=await handleWorkspaceResearch(request({...input,tariffVersion:previous,maximumCredits:current.maxCredits}))
  expect(await response.json()).toMatchObject({failure:{code:"pricing_changed"},reserved:false})
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
 })
 it("reads the saved model and approved maximum with the settled charge, never today's quote",async()=>{
  mocks.read.mockResolvedValue({id:ID(2),status:"failed",target:{...target,kind:"particle_research"},proposal:null,charged_credits:0,cancel_requested_at:null,tariff:{version:"saved-version",model:"saved-model",privateExtra:"must-not-leak"},max_credits:12})
  const receipt=await readResearchRun(ID(2),target)
  expect(receipt).toMatchObject({credits:0,processing:{provider:"OpenAI",model:"saved-model",tariffVersion:"saved-version",maximumCredits:12}})
  expect(JSON.stringify(receipt)).not.toContain("privateExtra");expect(mocks.config).not.toHaveBeenCalled()
 })
 it("keeps legacy missing receipt details unknown",async()=>{
  expect(await readResearchRun(ID(2),target)).not.toHaveProperty("processing")
 })
})
