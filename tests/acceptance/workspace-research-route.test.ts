import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ context:vi.fn(), config:vi.fn(), reserve:vi.fn(), claim:vi.fn(), settle:vi.fn(), correlate:vi.fn(), reconcile:vi.fn(), read:vi.fn(), provider:vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context",()=>({loadResearchContext:mocks.context}))
vi.mock("@/features/workspace-ai/server/research-config",()=>({researchConfig:mocks.config}))
vi.mock("@/features/workspace-ai/server/research-provider",()=>({runResearchProvider:mocks.provider}))
vi.mock("@/features/ai-credits",()=>({reserveAiRun:mocks.reserve,claimAiRun:mocks.claim,settleAiRun:mocks.settle,correlateAiResearchResponse:mocks.correlate,reconcileAiRun:mocks.reconcile,readAiRun:mocks.read}))
import { handleWorkspaceResearch } from "@/features/workspace-ai/server/research-run"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"
const target={organizationId:WORKSPACE,objectiveId:ID(1),revision:0}
const input={id:ID(2),target,prompt:"Develop this objective",skill:"planning",tariffVersion:"test",maximumCredits:20}
const request=(value:unknown=input,origin="http://localhost:3008")=>new Request("http://localhost:3008/api/workspace-ai/research",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(value)})
beforeEach(()=>{
 vi.resetAllMocks()
 mocks.context.mockResolvedValue({user:{id:ID(90)},canvasId:null})
 mocks.config.mockReturnValue({tariff:{version:"test"},maxCredits:20,maxCost:40000})
 mocks.reserve.mockResolvedValue({created:true});mocks.claim.mockResolvedValue(true)
 mocks.settle.mockResolvedValue(null);mocks.reconcile.mockResolvedValue(null)
 mocks.provider.mockResolvedValue({canceled:false,result:null,responseId:"response",usage:{input:10,cachedInput:0,output:2}})
 mocks.read.mockResolvedValue({id:ID(2),status:"failed",target:{...target,kind:"particle_research"},proposal:null,charged_credits:0,cancel_requested_at:null})
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
  mocks.provider.mockRejectedValue(new Error("Transport interrupted"))
  const response=await handleWorkspaceResearch(request())
  expect(await response.json()).toMatchObject({reserved:true})
  expect(mocks.reconcile).toHaveBeenCalledWith(ID(2),null)
  expect(mocks.provider).toHaveBeenCalledTimes(1);expect(mocks.settle).not.toHaveBeenCalled()
 })
 it("settles an unclaimed canceled request without a provider call",async()=>{
  mocks.claim.mockResolvedValue(false)
  await handleWorkspaceResearch(request())
  expect(mocks.provider).not.toHaveBeenCalled()
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"canceled",usage:{input:0,cachedInput:0,output:0}}))
 })
})
