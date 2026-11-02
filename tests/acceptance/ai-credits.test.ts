import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { priceAiUsage, aiCreditBalance } from "@/features/ai-credits/lib"
import { reserveAiRun, settleAiRun } from "@/features/ai-credits/server/accounting"
import { handleAiRecovery } from "@/features/ai-credits/server/recovery"

import { AiAdmissionDenied } from "@/features/ai-credits/server/admission-error"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/admin",() => ({ createSupabaseAdminClient: () => ({ rpc }) }))
beforeEach(() => rpc.mockReset())
afterEach(() => vi.unstubAllEnvs())

const rate = { version: "test",model: "fixture",inputMicrodollarsPerMillion: 2000000,
  cachedMicrodollarsPerMillion: 100000,outputMicrodollarsPerMillion: 10000000,microdollarsPerCredit: 2000 }
describe("AI credit accounting", () => {
  it("prices all output and cached input, rounding only the aggregate", () => {
    expect(priceAiUsage({ input: 6000,cachedInput: 0,output: 1500 },rate)).toEqual({ microdollars: 27000,credits: 14 })
    expect(priceAiUsage({ input: 6000,cachedInput: 1000,output: 1500 },rate)).toEqual({ microdollars: 25100,credits: 13 })
    expect(priceAiUsage({ input: 1,cachedInput: 0,output: 0 },rate)).toEqual({ microdollars: 2,credits: 1 })
  })
  it("rejects missing, impossible or unsafe usage instead of treating it as free", () => {
    for (const input of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER])
      expect(() => priceAiUsage({ input,cachedInput: 0,output: 1 },rate)).toThrow()
    expect(() => priceAiUsage({ input: 5,cachedInput: 6,output: 1 },rate)).toThrow()
    expect(() => priceAiUsage({ input: 5,cachedInput: 0,output: 1 },{...rate,microdollarsPerCredit: 0})).toThrow()
  })
  it("excludes spent and reserved credits without manufacturing an allowance percentage", () => {
    expect(aiCreditBalance({ enabled: true,history: [],lots: [
      { kind: "included",expiresAt: "2026-11-01",credits: 500,spent: 200,reserved: 100 },
      { kind: "purchased",expiresAt: null,credits: 1000,spent: 100,reserved: 0 },
    ] })).toEqual({ available: 1100,included: 200,purchased: 900,reserved: 100,held:0 })
  })
  it("shows expired in-flight reservations without making expired credits available", () => {
    expect(aiCreditBalance({ enabled:true,history:[],lots:[
      {kind:"included",expiresAt:"2026-01-01",expired:true,credits:500,spent:100,reserved:40},
    ]})).toEqual({available:0,included:0,purchased:0,reserved:40,held:0})
  })
  it("keeps restricted lots unavailable without removing consumed or pending allocations", () => {
    expect(aiCreditBalance({ enabled:true,history:[],lots:[
      {kind:"purchased",expiresAt:null,credits:1000,spent:100,reserved:40,restricted:true},
      {kind:"included",expiresAt:null,credits:50,spent:10,reserved:0},
    ]})).toEqual({available:40,included:40,purchased:0,reserved:40,held:860})
  })
  it("commits a terminal receipt before attempting settlement",async () => {
    rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{message:"Disconnected"}})
    await expect(settleAiRun({id:"run",status:"succeeded",usage:{input:10,cachedInput:0,output:1},tariff:rate,maxCredits:100,proposal:"<p>Draft</p>",responseId:"response"})).rejects.toThrow("Disconnected")
    expect(rpc.mock.calls.map(call=>call[0])).toEqual(["record_workspace_ai_result","settle_recorded_workspace_ai_run"])
    expect(rpc.mock.calls[0][1]).toMatchObject({p_cost:30,p_credits:1,p_response_id:"response"})
  })
  it("does not settle without a durable receipt",async () => {
    rpc.mockResolvedValue({error:{message:"Storage unavailable"}})
    await expect(settleAiRun({id:"run",status:"failed",usage:{input:10,cachedInput:0,output:1},tariff:rate,maxCredits:100,proposal:null,responseId:"response"})).rejects.toThrow("Storage unavailable")
    expect(rpc).toHaveBeenCalledOnce()
  })
  it("protects the recovery worker and keeps it independent from generation flags",async () => {
    vi.stubEnv("INTERNAL_CRON_SECRET","fixture-secret")
    vi.stubEnv("WORKSPACE_AI_RECOVERY_ENABLED","true")
    vi.stubEnv("WORKSPACE_AI_ENABLED","false")
    expect((await handleAiRecovery(new Request("http://localhost/api/internal/cron/workspace-ai-recovery"))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({data:2,error:null})
    const response = await handleAiRecovery(new Request("http://localhost/api/internal/cron/workspace-ai-recovery",{headers:{authorization:"Bearer fixture-secret"}}))
    expect(await response.json()).toEqual({recovered:2,morePossible:false})
    expect(rpc).toHaveBeenCalledWith("recover_workspace_ai_runs",{})
  })
})

describe("reservation rejection evidence",()=>{
 const input={id:"run",organizationId:"org",actorId:"actor",hash:"hash",task:"research" as const,target:{},prompt:"Research",tariff:rate,maxCredits:10,maxCost:20000}
 it.each([
  ["Not enough AI credits","credits_unavailable"],
  ["AI daily service limit reached","usage_limit"],
  ["Organization daily AI service limit reached","usage_limit"],
  ["AI provider safety limits are not configured","ai_disabled"],
  ["AI daily member limit reached","usage_limit"],
  ["AI hourly request limit reached","usage_limit"],
  ["Organization monthly AI credit limit reached","usage_limit"],
  ["Your monthly AI credit limit reached","usage_limit"],
  ["An AI request is already running","capacity_busy"],
  ["AI is not enabled for this organization","ai_disabled"],
 ])("classifies the confirmed SQL rejection %s",async(message,reason)=>{
  rpc.mockResolvedValue({error:{code:"P0001",message}})
  await expect(reserveAiRun(input)).rejects.toMatchObject({name:"AiAdmissionDenied",reason,message})
  expect(rpc).toHaveBeenCalledOnce()
 })
 it.each([
  {code:"42501",message:"AI access denied"},
  {code:"40001",message:"Objective changed"},
  {code:"P0001",message:"AI request identity conflict"},
  {code:"P0001",message:"Not enough AI credits: unexpected detail"},
  {code:"P0001",message:"toString"},
  {code:"PGRST000",message:"Not enough AI credits"},
  {message:"Not enough AI credits"},
 ])("keeps unqualified errors uncertain: $message / $code",async error=>{
  rpc.mockResolvedValue({error})
  const caught=await reserveAiRun(input).catch(error=>error)
  expect(caught).toBeInstanceOf(Error);expect(caught).not.toBeInstanceOf(AiAdmissionDenied)
 })
 it("does not infer rollback from a rejected transport or malformed success",async()=>{
  rpc.mockRejectedValueOnce(new Error("Not enough AI credits"))
  expect(await reserveAiRun(input).catch(error=>error)).not.toBeInstanceOf(AiAdmissionDenied)
  rpc.mockResolvedValueOnce({data:{created:"unknown"},error:null})
  const caught=await reserveAiRun(input).catch(error=>error)
  expect(caught).toBeInstanceOf(Error);expect(caught).not.toBeInstanceOf(AiAdmissionDenied)
 })
})
