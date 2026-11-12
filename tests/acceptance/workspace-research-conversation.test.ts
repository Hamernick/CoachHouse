import { beforeEach, expect, it, vi } from "vitest"
import { ID, WORKSPACE, graph, particle } from "./fixtures/particle-fixtures"
import type { ResearchContext } from "@/features/workspace-ai/server/research-context"
import type { ResearchDependencies, ResearchRequest, ResearchResult } from "@/features/workspace-ai/research-types"
import { mergeConversationDependencies } from "@/features/workspace-ai/lib/research-conversation"
const mocks = vi.hoisted(() => ({ canvas: vi.fn(), read: vi.fn(), snapshot: vi.fn(), rpc: vi.fn(), draft: vi.fn(), access: vi.fn(), context: vi.fn() }))
vi.mock("@/features/ai-credits", () => ({ readAiRun: mocks.read }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: (name: string, args: unknown) => name === "read_workspace_canvas_projection" ? mocks.canvas(args) : mocks.rpc(name, args) }) }))
vi.mock("@/features/workspace-ai/server/research-run", () => ({ readResearchRun: mocks.snapshot, researchRunSchema: { parse: (value: unknown) => value } }))
vi.mock("@/features/workspace-ai/server/research-output-draft", () => ({ readResearchOutputDraft: mocks.draft }))
vi.mock("@/features/workspace-ai/server/research-result-access", () => ({ assertResearchSourcesAccessible: mocks.access, assertResearchProvenance: vi.fn() }))
vi.mock("@/features/workspace-ai/server/research-context", () => ({ loadResearchContext: mocks.context }))
import { prepareResearchConversation } from "@/features/workspace-ai/server/research-conversation"
import { getWorkspaceConversation, updateWorkspaceConversation, prepareWorkspaceConversationTurn } from "@/features/workspace-ai/conversation-actions"
import { createResearchDraft } from "@/features/workspace-ai/lib/research-draft"
const target = { mode: "new_objective" as const, organizationId: WORKSPACE, canvasId: null, revision: 0 }
const context = { target, canvasId: null, user: { id: ID(90) }, graph: graph([]) } as ResearchContext
const dependencies: ResearchDependencies = { version: 1, contextFingerprint: "a".repeat(64), records: [] }
const result: ResearchResult = { target, runId: ID(1), title: "Garden", summary: "Prepare the garden", questions: [], decisions: [], sources: [], dependencies,
  items: [{ key: "first", title: "Prepare garden", kind: "note", description: "Start small", referenceId: null, evidenceIds: [], dependsOn: [] }] }
const request: ResearchRequest = { id: ID(2), target, prompt: "Use one raised bed", skill: "planning", tariffVersion: "fixture", maximumCredits: 10, parentRunId: ID(1) }
const tools = () => ({ attachDocumentRetrieval: vi.fn(), sources: new Map(), execute: vi.fn(), revalidate: vi.fn().mockResolvedValue(true), dependencies: () => dependencies, evidence: () => [] })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.canvas.mockReset().mockResolvedValue({ data: { state: {} }, error: null })
  mocks.snapshot.mockResolvedValue({ id: ID(1), result })
  mocks.read.mockResolvedValue({ id: ID(1), status: "succeeded", prompt: "Plan a garden", proposal: JSON.stringify(result), conversation_messages: [{ id: `${ID(1)}:user`, role: "user", parts: [{ type: "text", text: "Plan a garden" }] }, { id: `${ID(1)}:assistant`, role: "assistant", parts: [{ type: "text", text: result.summary }, { type: "data-plan", data: { runId: ID(1), title: result.title } }] }], target: { ...target, userId: ID(90), conversation: { id: ID(1), parentId: null, turn: 1, draftRevision: 0 } } })
  mocks.rpc.mockImplementation(async (name: string) => name === "manage_workspace_research_conversation" ? { data: { deleted: false } } : { data: [{ id: ID(1), rootId: ID(1), turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "succeeded" }] })
  mocks.draft.mockResolvedValue({ draft: null, revision: 0, attempted: false })
  mocks.context.mockResolvedValue(context)
  mocks.access.mockResolvedValue(undefined)
})
it("uses server-owned prompts and the saved human draft; binds its exact revision", async () => {
  const draft = createResearchDraft(result); draft.items[0].title = "Keep the donated bed"
  mocks.draft.mockResolvedValue({ draft, revision: 4, attempted: false })
  const prepared = await prepareResearchConversation(context, request, { tools: tools(), records: [] })
  expect(prepared.link).toEqual({ id: ID(1), parentId: ID(1), turn: 2, draftRevision: 4 })
  expect(JSON.stringify(prepared.prepared.records)).toContain("Plan a garden")
  expect(JSON.stringify(prepared.prepared.records)).toContain("Keep the donated bed")
  expect(mocks.snapshot).toHaveBeenCalledWith(ID(1), target)
  await prepared.prepared.tools.revalidate()
  expect(mocks.access).toHaveBeenCalledWith(context, result)
})
it("rejects a stale parent before reserving or sending anything", async () => {
  mocks.rpc.mockResolvedValue({ data: [
    { id: ID(1), rootId: ID(1), turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "succeeded" },
    { id: ID(3), rootId: ID(1), turn: 2, createdAt: "2026-11-05T12:01:00Z", status: "succeeded" },
  ] })
  await expect(prepareResearchConversation(context, request, { tools: tools(), records: [] })).rejects.toMatchObject({ code: "conversation_changed" })
})
it("refuses continuation once application has started", async () => {
  mocks.draft.mockResolvedValue({ draft: createResearchDraft(result), revision: 1, attempted: true })
  await expect(prepareResearchConversation(context, request, { tools: tools(), records: [] })).rejects.toMatchObject({ code: "conversation_changed" })
})
it("reconstructs the same parent for an exact run retry, without including the retry's own answer", async () => {
  mocks.rpc.mockResolvedValue({ data: [
    { id: ID(1), rootId: ID(1), turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "succeeded" },
    { id: request.id, rootId: ID(1), turn: 2, createdAt: "2026-11-05T12:01:00Z", status: "succeeded" },
  ] })
  const prepared = await prepareResearchConversation(context, request, { tools: tools(), records: [] })
  expect(prepared.link?.turn).toBe(2)
  expect(mocks.snapshot).toHaveBeenCalledTimes(1)
})
it("revoked inherited sources fail closed at every provider recheck", async () => {
  const prepared = await prepareResearchConversation(context, request, { tools: tools(), records: [] })
  mocks.access.mockRejectedValue(new Error("Revoked"))
  await expect(prepared.prepared.tools.revalidate()).rejects.toThrow("Revoked")
})
it("retains uncited detail dependencies when a later turn sees only metadata", () => {
  const record = { id: `document:${ID(3)}`, kind: "document" as const, fingerprint: "b".repeat(64), detailFingerprint: "c".repeat(64) }
  const merged = mergeConversationDependencies([{ ...dependencies, records: [record] }, { ...dependencies, records: [{ id: record.id, kind: record.kind, fingerprint: record.fingerprint }] }])
  expect(merged.records).toEqual([record])
  expect(() => mergeConversationDependencies([dependencies, { ...dependencies, contextFingerprint: "d".repeat(64) }])).toThrow("changed")
})

it("returns authorized saved references and withholds revoked derived history", async () => {
  const saved = savedContext()
  saved.graph.particles[0].title = "Renamed on the board"
  mocks.context.mockResolvedValue(saved)
  // Proposal recovery may be stale; history still uses persisted messages.
  mocks.snapshot.mockRejectedValue(new Error("Stale proposal"))
  const response = await getWorkspaceConversation(target, ID(1))
  expect(response.turns?.[0].savedPlan).toEqual({ id: ID(8), title: "Renamed on the board", description: null })
  expect(response.turns?.[0].messages?.[0].id).toBe(`${ID(1)}:user`)
  expect(response.turns?.[0].summary).toBe("Prepare the garden")
  expect(mocks.access).toHaveBeenCalledWith(saved, result, "history")
  mocks.access.mockRejectedValue(new Error("Revoked"))
  const revoked = await getWorkspaceConversation(target, ID(1))
  expect(revoked.turns?.[0]).toMatchObject({ unavailable: true, prompt: "" })
  expect(revoked.turns?.[0].savedPlan).toBeUndefined()
  expect(revoked.turns?.[0].messages).toBeUndefined()
})

it("derives mutation identity from authenticated context and validates the title", async () => {
  mocks.rpc.mockResolvedValue({ data: {title:"Garden chat",revision:1,pinned:false,deleted:false}, error:null })
  expect(await updateWorkspaceConversation(target,{action:"rename",rootId:ID(1),revision:0,title:" Garden chat "})).toEqual({ok:true})
  expect(mocks.rpc).toHaveBeenCalledWith("manage_workspace_research_conversation",expect.objectContaining({p_actor_id:ID(90),p_org_id:WORKSPACE,p_canvas_id:null,p_title:"Garden chat"}))
  mocks.rpc.mockClear()
  expect(await updateWorkspaceConversation(target,{action:"rename",rootId:ID(1),revision:0,title:" "})).toHaveProperty("error")
  expect(mocks.rpc).not.toHaveBeenCalled()
})

function savedContext(status: "pending" | "accepted" = "accepted") {
  const objective = particle(8, "objective")
  if (objective.type !== "objective") throw new Error("fixture")
  objective.revision = 3
  objective.data.planning = { plans: status === "accepted" ? [{ id: ID(9), revision: 2, title: "Garden", particleIds: [] }] : [],
    proposals: [{ id: ID(10), planId: ID(9), baseRevision: null, title: "Garden", particleIds: [], authorId: ID(90),
      createdAt: "2026-11-05T12:00:00Z", status, researchRunId: ID(1), ...(status === "accepted" ? { reviewedBy: ID(90), reviewedAt: "2026-11-05T12:01:00Z" } : {}) }] }
  return { ...context, graph: graph([objective]) }
}
it("continues an applied chat against its current accepted plan without replaying obsolete drafts", async () => {
  const current = savedContext()
  mocks.context.mockResolvedValue(current)
  mocks.snapshot.mockResolvedValue({ id: ID(1), result: null, appliedObjectiveId: ID(8) })
  mocks.draft.mockResolvedValue({ draft: createResearchDraft(result), revision: 2, attempted: true })
  const next = await prepareWorkspaceConversationTurn(target, ID(1))
  expect(next).toEqual({ target: { organizationId: WORKSPACE, objectiveId: ID(8), revision: 3, plan: { id: ID(9), revision: 2 } } })
  if (!next.target) throw new Error("target")
  const prepared = await prepareResearchConversation({ ...current, target: next.target }, { ...request, target: next.target }, { tools: tools(), records: [] })
  expect(prepared.link).toMatchObject({ id: ID(1), parentId: ID(1), turn: 2, draftRevision: 2 })
  expect(JSON.stringify(prepared.prepared.records)).toContain("current selected saved plan")
  expect(JSON.stringify(prepared.prepared.records)).not.toContain("Prepare garden")
  expect(mocks.access).not.toHaveBeenCalled()
})
it("does not silently accept a pending proposal or create a different plan", async () => {
  const current = savedContext("pending")
  mocks.context.mockResolvedValue(current)
  mocks.snapshot.mockResolvedValue({ id: ID(1), result: null, appliedObjectiveId: ID(8) })
  expect(await prepareWorkspaceConversationTurn(target, ID(1))).toEqual({ error: "Accept the proposed plan on the board before revising it in chat." })
  const accepted = savedContext()
  await expect(prepareResearchConversation(accepted, { ...request, target: { organizationId: WORKSPACE, objectiveId: ID(8), revision: 3, plan: { id: ID(99), revision: 2 } } }, { tools: tools(), records: [] })).rejects.toMatchObject({ code: "conversation_changed" })
})
it.each([ { userId: ID(91) }, { canvasId: ID(7) }, { organizationId: ID(99) } ])("rejects a saved chat outside its authenticated scope: %j", async changed => {
  const raw = await mocks.read()
  mocks.read.mockResolvedValue({ ...raw, target: { ...raw.target, ...changed } })
  expect(await prepareWorkspaceConversationTurn(target, ID(1))).toHaveProperty("error")
  await expect(prepareResearchConversation(context, request, { tools: tools(), records: [] })).rejects.toMatchObject({ code: "scope_mismatch" })
})

it("withholds continuation when the accepted plan has been deleted", async () => {
  const current = savedContext()
  const objective = current.graph.particles[0]
  if (objective.type !== "objective") throw new Error("fixture")
  objective.data.planning!.plans = []
  mocks.context.mockResolvedValue(current)
  mocks.snapshot.mockResolvedValue({ id: ID(1), result: null, appliedObjectiveId: ID(8) })
  const reply = await prepareWorkspaceConversationTurn(target, ID(1))
  expect(reply).toHaveProperty("error")
  expect(reply.error).not.toContain("Accept the proposed plan")
})

it("pages history with an authenticated keyset cursor and no inference", async () => {
  const reply = await getWorkspaceConversation(target, ID(1), 13)
  expect(reply.turns?.[0].prompt).toBe("Plan a garden")
  expect(mocks.rpc).toHaveBeenCalledWith("page_workspace_research_conversation", expect.objectContaining({ p_root_id: ID(1), p_before_turn: 13, p_actor_id: ID(90) }))
  expect(mocks.snapshot).not.toHaveBeenCalled()
  expect(await getWorkspaceConversation(target, ID(1), -1)).toHaveProperty("error")
})
it("never invents missing messages or accepts a mismatched persisted message ID", async () => {
  const raw = await mocks.read()
  for (const messages of [undefined, [{ id: `${ID(99)}:user`, role: "user", parts: [{ type: "text", text: "Wrong chat" }] }]]) {
    mocks.read.mockResolvedValue({ ...raw, conversation_messages: messages })
    expect((await getWorkspaceConversation(target, ID(1))).turns?.[0]).toMatchObject({ unavailable: true, prompt: "" })
  }
})
it("continues past turn twelve using only four recent turns, without enlarging request ceilings", async () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ id: ID(index + 5), rootId: ID(1), turn: index + 5, createdAt: "2026-11-05T12:00:00Z", status: "succeeded" }))
  mocks.rpc.mockResolvedValue({ data: entries })
  const raw = await mocks.read()
  mocks.read.mockImplementation(async (id: string) => ({ ...raw, id, prompt: `Turn ${entries.find(e => e.id === id)?.turn}`, target: { ...raw.target, conversation: { id: ID(1), parentId: ID(15), turn: entries.find(e => e.id === id)?.turn, draftRevision: 0 } } }))
  mocks.snapshot.mockImplementation(async (id: string) => ({ id, result: { ...result, runId: id } }))
  const prepared = await prepareResearchConversation(context, { ...request, id: ID(17), parentRunId: ID(16) }, { tools: tools(), records: [] })
  expect(prepared.link?.turn).toBe(17)
  expect(mocks.snapshot).toHaveBeenCalledTimes(4)
  expect(JSON.stringify(prepared.prepared.records)).toContain("Turn 13")
  expect(JSON.stringify(prepared.prepared.records)).not.toContain("Turn 12")
})

it("retains the last complete draft when four recent turns failed", async () => {
  const entries = [1,13,14,15,16].map(turn => ({ id: ID(turn), rootId: ID(1), turn, createdAt: "2026-11-05T12:00:00Z", status: turn === 1 ? "succeeded" : "failed" }))
  mocks.rpc.mockResolvedValue({ data: entries })
  const raw = await mocks.read()
  mocks.read.mockImplementation(async (id: string) => ({ ...raw, id, status: id === ID(1) ? "succeeded" : "failed", prompt: "Prior instruction", target: { ...raw.target, conversation: { id: ID(1), parentId: null, turn: entries.find(e => e.id === id)?.turn, draftRevision: 0 } } }))
  mocks.snapshot.mockImplementation(async (id: string) => ({ id, result: id === ID(1) ? result : null }))
  const prepared = await prepareResearchConversation(context, { ...request, id: ID(17), parentRunId: ID(16) }, { tools: tools(), records: [] })
  expect(JSON.stringify(prepared.prepared.records)).toContain("Prepare garden")
  expect(mocks.snapshot).toHaveBeenCalledTimes(5)
  expect(mocks.rpc).toHaveBeenCalledWith("page_workspace_research_conversation", expect.objectContaining({ p_before_turn: 17, p_for_context: true }))
})

it("continues after clarification without creating a plan checkpoint", async () => {
  const reply = { ...result, responseKind: "clarify" as const, items: [], summary: "How many volunteers?" }
  mocks.snapshot.mockResolvedValue({ id: ID(1), result: reply, applicability: "read_only" })
  const prepared = await prepareResearchConversation(context, request, { tools: tools(), records: [] })
  expect(prepared.link?.draftRevision).toBe(0)
  expect(mocks.draft).not.toHaveBeenCalled()
  expect(JSON.stringify(prepared.prepared.records)).toContain("How many volunteers?")
  await prepared.prepared.tools.revalidate()
  expect(mocks.access).toHaveBeenCalledWith(context, reply)
})
it("retains the last complete proposal across a succession of successful answers", async () => {
  const entries = [1, 5, 6, 7, 8].map(turn => ({ id: ID(turn), rootId: ID(1), turn, createdAt: "2026-11-05T12:00:00Z", status: "succeeded", responseKind: turn === 1 ? "proposal" : "answer" }))
  mocks.rpc.mockResolvedValue({ data: entries })
  mocks.read.mockImplementation(async id => ({ id, status: "succeeded", prompt: id === ID(1) ? "Plan a garden" : "Explain the pilot", target: { ...target, userId: ID(90), conversation: { id: ID(1), parentId: id === ID(1) ? null : ID(1), turn: entries.find(entry => entry.id === id)!.turn, draftRevision: 0 } } }))
  mocks.snapshot.mockImplementation(async id => ({ id, result: id === ID(1) ? result : { ...result, runId: id, responseKind: "answer", summary: "Start small.", items: [] } }))
  const prepared = await prepareResearchConversation(context, { ...request, id: ID(9), parentRunId: ID(8) }, { tools: tools(), records: [] })
  expect(prepared.link?.turn).toBe(9)
  expect(mocks.draft).toHaveBeenCalledTimes(1)
  expect(mocks.draft).toHaveBeenCalledWith(result, ID(90))
  expect(JSON.stringify(prepared.prepared.records)).toContain("Prepare garden")
  expect(JSON.stringify(prepared.prepared.records)).toContain('"includedTurns":[1,5,6,7,8]')
})
it("reads persisted replies as messages without inventing a saved-plan reference", async () => {
  const raw = await mocks.read()
  raw.proposal = JSON.stringify({ ...result, responseKind: "answer", items: [], summary: "Start small." })
  raw.conversation_messages[1].parts = [{ type: "text", text: "Start small." }, { type: "data-reply", data: { runId: ID(1), title: "Pilot question", kind: "answer" } }]
  mocks.read.mockResolvedValue(raw)
  const response = await getWorkspaceConversation(target, ID(1))
  expect(response.turns?.[0]).toMatchObject({ title: "Pilot question", summary: "Start small.", unavailable: false })
  expect(response.turns?.[0].savedPlan).toBeUndefined()
})

const hiddenCanvas = { workspaceCatalog: { version: 1, defaultName: "Workspace", defaultDeleted: true, entries: [] } }
it.each([null, ID(50)])("withholds all recent/page metadata when canvas %s becomes inaccessible", async canvasId => {
  const scoped = { ...context, canvasId, target: { ...target, canvasId } }
  mocks.context.mockResolvedValue(scoped)
  mocks.canvas.mockResolvedValue({ data: { state: hiddenCanvas }, error: null })
  for (const rootId of [null, ID(1)]) {
    expect(await getWorkspaceConversation(scoped.target, rootId)).toEqual({ error: "Chat could not be loaded. Retry." })
  }
  expect(mocks.canvas).toHaveBeenCalledWith({ p_org_id: WORKSPACE, p_actor_id: ID(90) })
})
it.each([null, ID(1)])("does not return earlier turns or custom titles after final page revocation (%s)", async rootId => {
  // The context and source reads passed before the assembled response check.
  mocks.canvas.mockResolvedValue({ data: { state: hiddenCanvas } })
  expect(await getWorkspaceConversation(target, rootId)).toEqual({ error: "Chat could not be loaded. Retry." })
  expect(mocks.access).toHaveBeenCalled()
  expect(mocks.canvas).toHaveBeenCalledTimes(1)
})
it.each(["running", "failed", "canceled"])("withholds a prompt-only %s history turn after canvas revocation", async status => {
  const raw = await mocks.read()
  mocks.read.mockResolvedValue({ ...raw, status, proposal: null, conversation_messages: [raw.conversation_messages[0]] })
  mocks.canvas.mockResolvedValue({ data: { state: hiddenCanvas } })
  expect(await getWorkspaceConversation(target, ID(1))).toEqual({ error: "Chat could not be loaded. Retry." })
  expect(mocks.access).not.toHaveBeenCalled()
})
it("does not restore a custom title through a source-denied recent/page fallback", async () => {
  const entry = { id: ID(1), rootId: ID(1), turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "succeeded", customTitle: "Private copied source title" }
  mocks.rpc.mockImplementation(async name => name === "manage_workspace_research_conversation" ? { data: { deleted: false } } : { data: [entry] })
  mocks.access.mockRejectedValue(new Error("Revoked source"))
  for (const rootId of [null, ID(1)]) {
    const response = await getWorkspaceConversation(target, rootId)
    expect(response.entries?.[0]).toMatchObject({ id: entry.id, customTitle: null, title: null })
    expect(JSON.stringify(response)).not.toContain(entry.customTitle)
  }
})
it("restores authorized history on a fresh request without changing the saved transcript", async () => {
  mocks.canvas.mockResolvedValue({ data: { state: hiddenCanvas } })
  expect(await getWorkspaceConversation(target, ID(1))).toHaveProperty("error")
  mocks.canvas.mockResolvedValue({ data: { state: {} } })
  expect((await getWorkspaceConversation(target, ID(1))).turns?.[0]).toMatchObject({ prompt: "Plan a garden", summary: result.summary, unavailable: false })
  expect(mocks.rpc.mock.calls.every(([name]) => name === "page_workspace_research_conversation" || name === "manage_workspace_research_conversation")).toBe(true)
})
