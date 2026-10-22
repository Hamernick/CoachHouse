import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { priceAiUsage, aiCreditBalance } from "@/features/ai-credits/lib"
import { settleAiRun } from "@/features/ai-credits/server/accounting"
import { handleAiRecovery } from "@/features/ai-credits/server/recovery"

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
    ] })).toEqual({ available: 1100,included: 200,purchased: 900,reserved: 100 })
  })
  it("shows expired in-flight reservations without making expired credits available", () => {
    expect(aiCreditBalance({ enabled:true,history:[],lots:[
      {kind:"included",expiresAt:"2026-01-01",expired:true,credits:500,spent:100,reserved:40},
    ]})).toEqual({available:0,included:0,purchased:0,reserved:40})
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
