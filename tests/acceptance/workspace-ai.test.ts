import { beforeEach, describe, expect, it, vi } from "vitest"
import { readWorkspaceAiProposal,cancelWorkspaceAi } from "@/features/workspace-ai/server/actions"
import { availableAiDocumentEditors,createAiDocumentRegistry,selectedAiDocumentEditor } from "@/features/workspace-ai/lib/document-registry"
import { handleWorkspaceAiDocument } from "@/features/workspace-ai/server/stream-handler"

const mocks = vi.hoisted(() => ({ retained: vi.fn(), actor: vi.fn(), source: vi.fn(), document: vi.fn(), reserve: vi.fn(), claim: vi.fn(), settle: vi.fn(), reconcile: vi.fn(), read: vi.fn(), provider: vi.fn(),correlate:vi.fn(),cancel:vi.fn() }))
vi.mock("@/features/workspace-ai/server/document-context",() => ({ loadAiDocument: mocks.document,loadAiDocumentSource:mocks.source,requireAiActor:mocks.actor }))
vi.mock("@/features/workspace-ai/server/document-source-access", () => ({ assertAiDocumentSources: async (id: string, target: unknown, selection: boolean, actor?: unknown) => {
  await mocks.retained(id, target, selection)
  if (!selection) await mocks.source(target, actor ?? await mocks.actor(target))
} }))
vi.mock("@/features/workspace-ai/server/config",() => ({ workspaceAiConfig: () => ({ tariff: {version:"test",model:"fixture"},maxInputBytes:70000,maxOutputTokens:6000,maxCredits:100,maxCost:200000 }) }))
vi.mock("@/features/workspace-ai/server/provider",() => ({ documentInstructions:"Untrusted document context",streamDocumentDraft:mocks.provider }))
vi.mock("@/features/ai-credits",() => ({ cancelAiRun:mocks.cancel,correlateAiResponse:mocks.correlate,reserveAiRun:mocks.reserve,claimAiRun:mocks.claim,settleAiRun:mocks.settle,reconcileAiRun:mocks.reconcile,readAiRun:mocks.read }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const target={ organizationId:id(1),userId:id(2),sectionId:"need",title:"Need Statement",revision:null }
const run={ id:id(3),actor_id:id(2),org_id:id(1),target:{...target,content:"<p>Original</p>"},status:"succeeded",proposal:"<p>Revised</p>",charged_credits:14,max_credits:100 }
function request(patch = {}) { return new Request("http://localhost:3008/api/workspace/ai/document",{method:"POST",headers:{origin:"http://localhost:3008"},body:JSON.stringify({ id:id(3),target,prompt:"Improve clarity",maximumCredits:100,tariffVersion:"test",...patch })}) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.retained.mockReset().mockResolvedValue(undefined)
  mocks.source.mockReset().mockResolvedValue(undefined)
  mocks.document.mockImplementation((...args) => mocks.actor(...args))
  mocks.actor.mockResolvedValue({ userId:id(2),organizationId:id(1),section:{ title:target.title,content:"<p>Original</p>" } })
  mocks.reserve.mockResolvedValue({created:true,run});mocks.claim.mockResolvedValue(true)
  mocks.settle.mockResolvedValue(run);mocks.read.mockResolvedValue(run);mocks.reconcile.mockResolvedValue(undefined)
  mocks.provider.mockImplementation(async ({onText,onResponse}) => { await onResponse("response-1");await onText("<p>Revised</p>");return {text:"<p>Revised</p>",usage:{input:6000,cachedInput:0,output:1500},completed:true} })
})
describe("metered document assistance", () => {
  it("rejects cross-origin and oversized requests before authentication or spending",async()=>{
    const foreign=new Request("http://localhost:3008/api/workspace/ai/document",{method:"POST",headers:{origin:"https://attacker.test"},body:"{}"})
    expect((await handleWorkspaceAiDocument(foreign)).status).toBe(403)
    expect((await handleWorkspaceAiDocument(request({prompt:"x".repeat(13000)}))).status).toBe(400)
    expect(mocks.actor).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it("authorizes and reserves before provider work, and settles before delivering a usable proposal", async () => {
    mocks.read.mockResolvedValueOnce({...run,status:"running",cancel_requested_at:null})
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
  it("withholds later private previews after cancellation while retaining measured settlement", async () => {
    mocks.read.mockResolvedValueOnce({...run,status:"running",cancel_requested_at:null})
      .mockResolvedValue({...run,status:"running",cancel_requested_at:"2026-11-02T12:00:00Z"})
    mocks.settle.mockResolvedValue({...run,status:"canceled",proposal:null,charged_credits:0})
    mocks.provider.mockImplementation(async ({onText,onResponse}) => {
      await onResponse("response-1")
      await onText("Allowed before closure")
      await onText("Private after closure")
      await onText("Still private")
      return {text:"Provider terminal result",usage:{input:100,cachedInput:0,output:50},completed:true}
    })
    const result=await (await handleWorkspaceAiDocument(request())).text()
    expect(result).toContain("Allowed before closure")
    expect(result).not.toContain("Private after closure")
    expect(result).not.toContain("Still private")
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({usage:{input:100,cachedInput:0,output:50},responseId:"response-1"}))
    expect(result).toContain('"status":"canceled"')
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


describe("explicit document context",()=>{
  it("does not silently switch an explicit or removed selection when editors mount, update or close",()=>{
    const registry=createAiDocumentRegistry()
    const bridge={target,content:"<p>Original</p>",dirty:false,saving:false,apply:()=>true}
    registry.update("first",bridge)
    expect(selectedAiDocumentEditor(registry.snapshot(),undefined)?.id).toBe("first")
    registry.update("second",{...bridge,target:{...target,sectionId:"mission"}})
    expect(selectedAiDocumentEditor(registry.snapshot(),undefined)).toBeNull()
    expect(selectedAiDocumentEditor(registry.snapshot(),"first")?.target.sectionId).toBe("need")
    const states:string[][]=[]
    const unsubscribe=registry.subscribe(()=>states.push(registry.snapshot().map(editor=>editor.id)))
    registry.update("first",{...bridge,dirty:true})
    expect(states).toEqual([["first","second"]])
    expect(selectedAiDocumentEditor(registry.snapshot(),null)).toBeNull()
    registry.update("first",null)
    expect(selectedAiDocumentEditor(registry.snapshot(),"first")).toBeNull()
    unsubscribe()
  })
  it("filters mounted editors by both current actor and organization",()=>{
    const registry=createAiDocumentRegistry()
    const bridge={target,content:"private",dirty:false,saving:false,apply:()=>true}
    registry.update("current",bridge)
    registry.update("other-org",{...bridge,target:{...target,organizationId:id(9)}})
    registry.update("other-user",{...bridge,target:{...target,userId:id(9)}})
    expect(availableAiDocumentEditors(registry.snapshot(),target).map(editor=>editor.id)).toEqual(["current"])
  })
  it("rejects cross-document status and cancellation while allowing same-document recovery after a save",async()=>{
    await expect(readWorkspaceAiProposal(run.id,{...target,sectionId:"mission"})).rejects.toThrow("another document")
    await expect(cancelWorkspaceAi(run.id,{...target,sectionId:"mission"})).rejects.toThrow("another document")
    expect(mocks.cancel).not.toHaveBeenCalled()
    await expect(readWorkspaceAiProposal(run.id,{...target,revision:"new saved revision"})).resolves.toMatchObject({id:run.id})
    await cancelWorkspaceAi(run.id,target)
    expect(mocks.cancel).toHaveBeenCalledWith(run.id,target.organizationId,target.userId)
  })
})


describe("Selected-text AI requests", () => {
  const selectedTarget = { ...target, sectionId: `selection:${id(5)}`, revision: id(5) }
  const selection = { from: 12, to: 24, html: "neighborhood" }
  it("meters only explicitly supplied text without loading the canonical document", async () => {
    await (await handleWorkspaceAiDocument(request({ target: selectedTarget, selection }))).text()
    const input = mocks.provider.mock.calls[0][0]
    expect(input.selectionOnly).toBe(true)
    expect(mocks.document).not.toHaveBeenCalled()
    expect(JSON.parse(input.context)).toEqual({ selectedText: { title: "Selected text", content: "neighborhood" }, request: "Improve clarity" })
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ selection, content: "neighborhood" }) }))
  })
  it("rejects missing namespaces, empty ranges and oversized selections before charging", async () => {
    for (const patch of [
      { target, selection },
      { target: selectedTarget, selection: { ...selection, to: 12 } },
      { target: selectedTarget, selection: { ...selection, html: "x".repeat(6001) } },
      { target: selectedTarget, selection: { ...selection, html: "&".repeat(1500) } },
      { target: selectedTarget, selection: { ...selection, html: "<script>secret()</script>" } },
    ]) expect((await handleWorkspaceAiDocument(request(patch))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("preserves actor authorization and stored selection scope on recovery", async () => {
    mocks.actor.mockRejectedValueOnce(new Error("Forbidden"))
    expect((await handleWorkspaceAiDocument(request({ target: selectedTarget, selection }))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    mocks.read.mockResolvedValueOnce({ ...run, target: { ...selectedTarget, content: "neighborhood", selection } })
    expect(await readWorkspaceAiProposal(id(3), selectedTarget)).toMatchObject({ selection, original: "neighborhood" })
  })
})


describe("document proposal source disclosure", () => {
  it("rechecks the stored document before recovery without blocking cancellation", async () => {
    mocks.source.mockRejectedValue(new Error("Source unavailable"))
    await expect(readWorkspaceAiProposal(run.id, target)).rejects.toThrow("Source unavailable")
    expect(mocks.source).toHaveBeenCalledWith(expect.objectContaining({ sectionId: "need" }), expect.objectContaining({ userId: target.userId }))
    await cancelWorkspaceAi(run.id, target)
    expect(mocks.cancel).toHaveBeenCalledWith(run.id, target.organizationId, target.userId)
  })
  it("keeps explicitly supplied selections independent of stored documents", async () => {
    const selectedTarget = { ...target, sectionId: `selection:${id(5)}`, revision: id(5) }
    mocks.read.mockResolvedValue({ ...run, target: { ...selectedTarget, content: "Passage", selection: { from: 1, to: 8, html: "Passage" } } })
    mocks.source.mockRejectedValue(new Error("No core source"))
    await expect(readWorkspaceAiProposal(run.id, selectedTarget)).resolves.toMatchObject({ original: "Passage" })
    expect(mocks.source).not.toHaveBeenCalled()
  })
  it("withholds durable replay after a source switch without spending again", async () => {
    mocks.reserve.mockResolvedValue({ created: false, run })
    mocks.source.mockRejectedValue(new Error("Source unavailable"))
    const response = await handleWorkspaceAiDocument(request())
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain("Revised")
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.reconcile).not.toHaveBeenCalled()
  })
  it.each(["source switched", "source lookup failed"])("withholds later previews and final output when %s", async reason => {
    mocks.read.mockResolvedValue({ ...run, status: "running", cancel_requested_at: null })
    mocks.source.mockResolvedValueOnce(undefined).mockRejectedValue(new Error(reason))
    mocks.provider.mockImplementation(async ({ onText }) => {
      await onText("Visible before switch")
      await onText("Hidden after switch")
      await onText("Still hidden")
      return { text: "Hidden final output", usage: { input: 100, cachedInput: 0, output: 50 }, completed: true }
    })
    const response = await (await handleWorkspaceAiDocument(request())).text()
    expect(response).toContain("Visible before switch")
    expect(response).not.toMatch(/Hidden|Still hidden|"type":"proposal"/)
    expect(response).toContain('"type":"error"')
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ usage: { input: 100, cachedInput: 0, output: 50 } }))
    expect(mocks.provider).toHaveBeenCalledOnce()
  })
  it("rechecks final output even when the provider emits no previews", async () => {
    mocks.provider.mockResolvedValue({ text: "Hidden final", usage: { input: 1, cachedInput: 0, output: 1 }, completed: true })
    mocks.source.mockRejectedValue(new Error("Source unavailable"))
    const response = await (await handleWorkspaceAiDocument(request())).text()
    expect(response).not.toContain("Hidden final")
    expect(response).toContain('"type":"error"')
    expect(mocks.settle).toHaveBeenCalledOnce()
  })
  it("withholds the original document after an unclaimed run is settled", async () => {
    mocks.claim.mockResolvedValue(false)
    mocks.source.mockRejectedValue(new Error("Source unavailable"))
    const response = await handleWorkspaceAiDocument(request())
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain("Original")
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.settle).toHaveBeenCalledOnce()
  })
})


describe("retained document sources at disclosure boundaries", () => {
  it("blocks recovery and replay when retained references cannot be verified", async () => {
    mocks.retained.mockRejectedValue(new Error("Sources unavailable"))
    await expect(readWorkspaceAiProposal(run.id, target)).rejects.toThrow("Sources unavailable")
    mocks.reserve.mockResolvedValue({ created: false, run })
    expect((await handleWorkspaceAiDocument(request())).status).toBe(400)
    expect(mocks.provider).not.toHaveBeenCalled()
    await cancelWorkspaceAi(run.id, target)
    expect(mocks.cancel).toHaveBeenCalledOnce()
  })
  it("does not send an unresolved prior draft to the provider or reserve credits", async () => {
    mocks.read.mockResolvedValueOnce({ ...run, id: id(4) })
    mocks.retained.mockRejectedValue(new Error("Sources unavailable"))
    expect((await handleWorkspaceAiDocument(request({ reviseRunId: id(4) }))).status).toBe(400)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.provider).not.toHaveBeenCalled()
  })
  it("withholds previews and final output but settles provider usage after a retained-source read failure", async () => {
    mocks.read.mockResolvedValue({ ...run, status: "running" })
    mocks.retained.mockRejectedValue(new Error("Sources unavailable"))
    const response = await (await handleWorkspaceAiDocument(request())).text()
    expect(response).not.toMatch(/Revised|Original|"type":"text"|"type":"proposal"/)
    expect(response).toContain('"type":"error"')
    expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ usage: { input: 6000, cachedInput: 0, output: 1500 } }))
  })
})
