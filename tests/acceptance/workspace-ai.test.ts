import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleWorkspaceAiDocument } from "@/features/workspace-ai/server/stream-handler"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), reserve: vi.fn(), claim: vi.fn(), settle: vi.fn(), reconcile: vi.fn(), read: vi.fn(), provider: vi.fn(),correlate:vi.fn() }))
vi.mock("@/features/workspace-ai/server/document-context",() => ({ loadAiDocument: mocks.actor }))
vi.mock("@/features/workspace-ai/server/config",() => ({ workspaceAiConfig: () => ({ tariff: {version:"test",model:"fixture"},maxInputBytes:70000,maxOutputTokens:6000,maxCredits:100,maxCost:200000 }) }))
vi.mock("@/features/workspace-ai/server/provider",() => ({ documentInstructions:"Untrusted document context",streamDocumentDraft:mocks.provider }))
vi.mock("@/features/ai-credits",() => ({ correlateAiResponse:mocks.correlate,reserveAiRun:mocks.reserve,claimAiRun:mocks.claim,settleAiRun:mocks.settle,reconcileAiRun:mocks.reconcile,readAiRun:mocks.read }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const target={ organizationId:id(1),userId:id(2),sectionId:"need",title:"Need Statement",revision:null }
const run={ id:id(3),actor_id:id(2),org_id:id(1),target:{...target,content:"<p>Original</p>"},status:"succeeded",proposal:"<p>Revised</p>",charged_credits:14,max_credits:100 }
function request(patch = {}) { return new Request("http://localhost:3008/api/workspace/ai/document",{method:"POST",headers:{origin:"http://localhost:3008"},body:JSON.stringify({ id:id(3),target,prompt:"Improve clarity",maximumCredits:100,tariffVersion:"test",...patch })}) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.actor.mockResolvedValue({ userId:id(2),organizationId:id(1),section:{ title:target.title,content:"<p>Original</p>" } })
  mocks.reserve.mockResolvedValue({created:true,run});mocks.claim.mockResolvedValue(true)
  mocks.settle.mockResolvedValue(run);mocks.read.mockResolvedValue(run);mocks.reconcile.mockResolvedValue(undefined)
  mocks.provider.mockImplementation(async ({onText,onResponse}) => { await onResponse("response-1");onText("<p>Revised</p>");return {text:"<p>Revised</p>",usage:{input:6000,cachedInput:0,output:1500},completed:true} })
})
describe("metered document assistance", () => {
  it("rejects cross-origin and oversized requests before authentication or spending",async()=>{
    const foreign=new Request("http://localhost:3008/api/workspace/ai/document",{method:"POST",headers:{origin:"https://attacker.test"},body:"{}"})
    expect((await handleWorkspaceAiDocument(foreign)).status).toBe(403)
    expect((await handleWorkspaceAiDocument(request({prompt:"x".repeat(13000)}))).status).toBe(400)
    expect(mocks.actor).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it("authorizes and reserves before provider work, and settles before delivering a usable proposal", async () => {
    const response = await handleWorkspaceAiDocument(request())
    const parts = (await response.text()).trim().split("\n").map(line=>JSON.parse(line))
    expect(parts.map(part=>part.type)).toEqual(["start","text","proposal"])
    expect(mocks.actor.mock.invocationCallOrder[0]).toBeLessThan(mocks.reserve.mock.invocationCallOrder[0])
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.provider.mock.invocationCallOrder[0])
    expect(mocks.correlate).toHaveBeenCalledWith(id(3),"response-1")
    expect(mocks.correlate.mock.invocationCallOrder[0]).toBeLessThan(mocks.settle.mock.invocationCallOrder[0])
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"succeeded",proposal:"<p>Revised</p>"}))
    expect(parts[2].proposal.credits).toBe(14)
  })
  it("fails closed on access, stale-price or reservation denial", async () => {
    mocks.actor.mockRejectedValueOnce(new Error("Forbidden"))
    expect((await handleWorkspaceAiDocument(request())).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect((await handleWorkspaceAiDocument(request({maximumCredits:99}))).status).toBe(400)
    mocks.reserve.mockRejectedValueOnce(new Error("Not enough AI credits"))
    expect((await handleWorkspaceAiDocument(request())).status).toBe(400)
    expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("returns a durable replay without a second provider call", async () => {
    mocks.reserve.mockResolvedValue({created:false,run})
    expect(await (await handleWorkspaceAiDocument(request())).json()).toMatchObject({proposal:{id:id(3),credits:14}})
    expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("sanitizes a proposed document before storing it", async () => {
    mocks.provider.mockResolvedValue({text:'<p>Hello</p><script>alert(1)</script><img src=x onerror=alert(1)>',usage:{input:1,cachedInput:0,output:10},completed:true})
    await (await handleWorkspaceAiDocument(request())).text()
    expect(mocks.settle.mock.calls[0][0].proposal).not.toMatch(/script|onerror/)
  })
  it("does not charge or deliver a truncated result", async () => {
    mocks.provider.mockResolvedValue({text:"Partial",usage:{input:1,cachedInput:0,output:10},completed:false})
    await (await handleWorkspaceAiDocument(request())).text()
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"failed",proposal:null}))
  })
  it("holds ambiguous usage for reconciliation instead of retrying or releasing spend", async () => {
    mocks.provider.mockRejectedValue(new Error("Connection lost"))
    const text = await (await handleWorkspaceAiDocument(request())).text()
    expect(text).toContain('"type":"error"')
    expect(mocks.reconcile).toHaveBeenCalledWith(id(3),null)
    expect(mocks.settle).not.toHaveBeenCalled();expect(mocks.provider).toHaveBeenCalledOnce()
  })
  it("does not invoke the provider when the request was stopped before claiming", async () => {
    mocks.claim.mockResolvedValue(false)
    await (await handleWorkspaceAiDocument(request())).text()
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({status:"failed",usage:{input:0,cachedInput:0,output:0}}))
  })
  it("revises a previous private proposal as a separately metered request",async()=>{
    mocks.read.mockResolvedValueOnce({...run,id:id(4),proposal:"<p>Previous proposed wording</p>"})
    await (await handleWorkspaceAiDocument(request({reviseRunId:id(4),prompt:"Make it shorter"}))).text()
    const context=JSON.parse(mocks.provider.mock.calls[0][0].context)
    expect(context.draftToRevise).toBe("<p>Previous proposed wording</p>")
    expect(context.document.content).toBe("<p>Original</p>")
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({id:id(3),target:expect.objectContaining({revisionSourceRunId:id(4)})}))
    expect(mocks.settle).toHaveBeenCalledOnce()
  })
  it("rejects stale, cross-document and already-applied revision sources before spending",async()=>{
    for (const source of [
      {...run,target:{...run.target,sectionId:"mission"}},
      {...run,target:{...run.target,revision:"changed"}},
      {...run,target:{...run.target,organizationId:id(8)}},
      {...run,application:{run_id:id(3),section_id:"need",saved_revision:"saved",content_hash:"a".repeat(64),saved_at:"2026-10-22"}},
    ]) {
      mocks.read.mockResolvedValueOnce(source)
      expect((await handleWorkspaceAiDocument(request({reviseRunId:id(4)}))).status).toBe(400)
    }
    expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()
  })
})
