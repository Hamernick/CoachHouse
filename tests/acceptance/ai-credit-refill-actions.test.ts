import { afterEach,beforeEach,expect,it,vi } from "vitest"
import { checkCreditRefill,disableCreditRefill,loadCreditRefill,recoverCreditRefill,startCreditRefill } from "@/features/ai-credits/refill-actions"
const mocks=vi.hoisted(()=>({context:vi.fn(),rpc:vi.fn(),open:vi.fn(),verify:vi.fn(),read:vi.fn(),charge:vi.fn(),cancel:vi.fn(),reconcile:vi.fn()}))
vi.mock("@/features/ai-credits/server/billing-context",()=>({creditBillingContext:mocks.context}))
vi.mock("@/features/ai-credits/server/refill-store",async importOriginal=>({...await importOriginal<typeof import("@/features/ai-credits/server/refill-store")>(),refillDb:()=>({rpc:mocks.rpc}),readRefillAttempt:mocks.read}))
vi.mock("@/features/ai-credits/server/refill-setup",()=>({openRefillSetup:mocks.open,verifyRefillSetup:mocks.verify}))
vi.mock("@/features/ai-credits/server/refill-payment",()=>({chargeRefill:mocks.charge,cancelRefill:mocks.cancel,reconcileRefill:mocks.reconcile}))
vi.mock("@/lib/env",()=>({env:{NEXT_PUBLIC_APP_URL:"http://localhost:3008"}}))
const org="90000000-0000-4000-8000-000000000001",id="90000000-0000-4000-8000-000000000002"
const input={organizationId:org,id,pack:"fixture",threshold:100,monthlyPacks:3,consent:true as const,consentVersion:"refill-v1" as const}
const view={setup:null,used:0,pending:null,resetAt:"2026-11-01T00:00:00Z"}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("WORKSPACE_AI_REFILLS_ENABLED","true");vi.stubEnv("WORKSPACE_AI_PURCHASES_ENABLED","true");mocks.context.mockResolvedValue({orgId:org,actorId:org,runtime:{mode:"test",target:"primary",client:{}}});mocks.rpc.mockResolvedValue({data:view,error:null})})
afterEach(()=>vi.unstubAllEnvs())
it("never starts card setup when disabled or consent is missing",async()=>{
  vi.stubEnv("WORKSPACE_AI_REFILLS_ENABLED","false")
  await expect(startCreditRefill(input)).rejects.toThrow("not enabled")
  await expect(startCreditRefill({...input,consent:false} as unknown as typeof input)).rejects.toThrow()
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.open).not.toHaveBeenCalled()
})
it("rejects staff before creating consent or exposing settings",async()=>{
  mocks.context.mockResolvedValue({orgId:org,actorId:id,runtime:{mode:"test",client:{}}})
  await expect(startCreditRefill(input)).rejects.toThrow("organization owner")
  expect(await loadCreditRefill(org)).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled()
})
it("ordinary status reads and checks cannot create payments",async()=>{
  await loadCreditRefill(org);await checkCreditRefill(org)
  expect(mocks.open).not.toHaveBeenCalled();expect(mocks.charge).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls.every(call=>call[0]==="read_ai_credit_refill")).toBe(true)
})
it("allows owner disabling while new charges are switched off",async()=>{
  vi.stubEnv("WORKSPACE_AI_REFILLS_ENABLED","false");vi.stubEnv("WORKSPACE_AI_PURCHASES_ENABLED","false")
  await disableCreditRefill(org)
  expect(mocks.rpc).toHaveBeenCalledWith("disable_ai_credit_refill",{p_input:{organizationId:org,actorId:org,mode:"test"}})
  expect(mocks.charge).not.toHaveBeenCalled()
})
it.each([{org_id:id},{actor_id:id},{mode:"live"},{runtime_target:"tester"}])("rejects foreign payment recovery %j",async patch=>{
  mocks.read.mockResolvedValue({setup:{org_id:org,actor_id:org,mode:"test",runtime_target:"primary",...patch},order:{id}})
  await expect(recoverCreditRefill({organizationId:org,id,action:"retry"})).rejects.toThrow("access denied")
  expect(mocks.charge).not.toHaveBeenCalled()
})
it("allows verified cancellation but not retry with charges disabled",async()=>{
  vi.stubEnv("WORKSPACE_AI_REFILLS_ENABLED","false")
  mocks.read.mockResolvedValue({setup:{org_id:org,actor_id:org,mode:"test",runtime_target:"primary"},order:{id}})
  await expect(recoverCreditRefill({organizationId:org,id,action:"retry"})).rejects.toThrow("not enabled")
  await recoverCreditRefill({organizationId:org,id,action:"cancel"})
  expect(mocks.cancel).toHaveBeenCalledWith(id,org,"test",{});expect(mocks.charge).not.toHaveBeenCalled()
})
