import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ actor: vi.fn(), read: vi.fn(), rpc: vi.fn(), admin: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveAuthenticatedAppContext: mocks.actor }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/features/workspace-ai/server/research-run", () => ({ readResearchRun: mocks.read }))
import { accessWorkspaceResearchDraft } from "@/features/workspace-ai/research-draft-actions"
import { createResearchDraft, applyResearchDraft, validateResearchRecoveryDraft } from "@/features/workspace-ai/lib/research-draft"
import { researchDraftCheckpointSchema, sameResearchDraft } from "@/features/workspace-ai/lib/research-draft-checkpoint"
import type { ResearchResult } from "@/features/workspace-ai/research-types"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"
const target = { organizationId: WORKSPACE, objectiveId: ID(1), revision: 0 }
const result: ResearchResult = { runId: ID(2), target, title: "Plan", summary: "", questions: [], sources: [], items: [
  { key: "first", title: "First", description: "", kind: "note", referenceId: null, evidenceIds: [], dependsOn: [] },
] }
const draft = () => ({ ...createResearchDraft(result), title: "Private edits" })
const write = () => ({ revision: 0, editId: ID(3), draft: draft(), attempted: false })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.actor.mockResolvedValue({ user: { id: ID(90) }, activeOrg: { orgId: WORKSPACE } })
  mocks.read.mockResolvedValue({ result, applicability: "review_required" })
  mocks.admin.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: { revision: 1, draft: draft(), attempted: false }, error: null })
})
describe("private research draft checkpoints", () => {
  it("compares normalized fields despite JSON key order", () => {
    const { title, ...rest } = draft()
    expect(sameResearchDraft(draft(), { title, ...rest })).toBe(true)
    expect(sameResearchDraft(draft(), { ...draft(), title: "Different" })).toBe(false)
    expect(sameResearchDraft({ ...draft(), title: "" }, { ...draft(), title: "" })).toBe(true)
    expect(sameResearchDraft({ ...draft(), title: " " }, { ...draft(), title: "" })).toBe(false)
  })
  it("saves only validated edits with verified actor and server-derived base", async () => {
    expect(await accessWorkspaceResearchDraft(ID(2), target, write())).toEqual({ checkpoint: { revision: 1, draft: draft(), attempted: false } })
    expect(mocks.read).toHaveBeenCalledWith(ID(2), target)
    expect(mocks.rpc).toHaveBeenCalledWith("access_workspace_research_draft", expect.objectContaining({ p_actor_id: ID(90), p_run_id: ID(2), p_org_id: WORKSPACE, p_base: expect.stringMatching(/^[a-f0-9]{64}$/), p_draft: draft(), p_revision: 0, p_edit_id: ID(3) }))
    expect(mocks.read.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0])
  })
  it("loads only after the saved result and its sources are authorized", async () => {
    expect(await accessWorkspaceResearchDraft(ID(2), target)).toHaveProperty("checkpoint.draft.title", "Private edits")
    expect(mocks.rpc).toHaveBeenCalledWith("access_workspace_research_draft", expect.objectContaining({ p_edit_id: null, p_revision: null }))
  })
  it.each(["revoked source", "foreign run", "missing target", "changed source"])("withholds recovery on %s", async message => {
    mocks.read.mockRejectedValue(new Error(message))
    const reply = await accessWorkspaceResearchDraft(ID(2), target)
    expect(reply).toHaveProperty("error"); expect(JSON.stringify(reply)).not.toContain(message)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects an organization switch", async () => {
    mocks.actor.mockResolvedValue({ user: { id: ID(90) }, activeOrg: { orgId: ID(99) } })
    expect(await accessWorkspaceResearchDraft(ID(2), target, write())).toHaveProperty("error")
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([null, { ...result, runId: ID(2) }])("requires a reviewable result", async value => {
    mocks.read.mockResolvedValue({ result: value, applicability: "already_applied" })
    expect(await accessWorkspaceResearchDraft(ID(2), target, write())).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([
    () => ({ ...write(), actorId: ID(91) }),
    () => ({ ...write(), revision: -1 }),
    () => ({ ...write(), draft: { ...draft(), title: "x".repeat(241) } }),
    () => ({ ...write(), attempted: true, draft: { ...draft(), title: "" } }),
    () => ({ ...write(), draft: { ...draft(), sources: [] } }),
    () => ({ ...write(), draft: { ...draft(), items: [] } }),
    () => ({ ...write(), draft: { ...draft(), items: [{ ...draft().items[0], dependsOn: ["first"] }] } }),
    () => ({ ...write(), draft: null, attempted: true }),
  ])("rejects forged, malformed and semantically invalid writes", async input => {
    expect(await accessWorkspaceResearchDraft(ID(2), target, input())).toHaveProperty("error")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("retains a discard tombstone through the same revision writer", async () => {
    mocks.rpc.mockResolvedValue({ data: { revision: 2, draft: null, attempted: false } })
    expect(await accessWorkspaceResearchDraft(ID(2), target, { ...write(), revision: 1, draft: null })).toEqual({ checkpoint: { revision: 2, draft: null, attempted: false } })
  })
  it("returns a safe conflict without replacing local edits", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001", message: "private details" } })
    expect(await accessWorkspaceResearchDraft(ID(2), target, write())).toEqual({ error: "Draft changed elsewhere. Reopen research before saving.", conflict: true })
  })
  it("rejects corrupt stored draft relationships", async () => {
    mocks.rpc.mockResolvedValue({ data: { revision: 1, draft: { ...draft(), items: [] }, attempted: false } })
    expect(await accessWorkspaceResearchDraft(ID(2), target)).toHaveProperty("error")
  })
  it("pins attempted proposals and rejects unsupported checkpoint shapes", async () => {
    mocks.rpc.mockResolvedValue({ data: { revision: 2, draft: draft(), attempted: true } })
    expect(await accessWorkspaceResearchDraft(ID(2), target, { ...write(), revision: 1, attempted: true })).toHaveProperty("checkpoint.attempted", true)
    expect(researchDraftCheckpointSchema.safeParse({ revision: 1, draft: null, attempted: true }).success).toBe(false)
    expect(researchDraftCheckpointSchema.safeParse({ revision: 1, draft: draft(), attempted: false, actorId: ID(90) }).success).toBe(false)
  })
})


describe("unfinished private recovery copy", () => {
  it.each(["", "  "])("saves and restores exact unfinished copy %j without making it applicable", async title => {
    const unfinished = { ...draft(), title, items: [{ ...draft().items[0], title: "" }],
      addedItems: [{ key: "new", title: "", description: "Notes before naming", dependsOn: ["first"] }] }
    mocks.rpc.mockResolvedValue({ data: { revision: 1, draft: unfinished, attempted: false } })
    expect(await accessWorkspaceResearchDraft(ID(2), target, { ...write(), draft: unfinished })).toHaveProperty("checkpoint.draft", unfinished)
    expect(mocks.rpc.mock.calls[0][1].p_draft).toEqual(unfinished)
    expect(await accessWorkspaceResearchDraft(ID(2), target)).toHaveProperty("checkpoint.draft", unfinished)
    expect(() => applyResearchDraft(result, unfinished)).toThrow()
  })
  it("rejects a stored incomplete application attempt", async () => {
    mocks.rpc.mockResolvedValue({ data: { revision: 1, draft: { ...draft(), title: "" }, attempted: true } })
    expect(await accessWorkspaceResearchDraft(ID(2), target)).toHaveProperty("error")
  })
  it("keeps graph checks when copy is incomplete", () => {
    for (const dependsOn of [["first"], ["missing"]]) {
      expect(() => validateResearchRecoveryDraft(result, { ...draft(), title: "", items: [{ ...draft().items[0], title: "", dependsOn }] })).toThrow()
    }
  })
  it("preserves empty outcome labels but retains identities, bounds and canonical validation", () => {
    const decisionResult: ResearchResult = { ...result,
      items: [{ ...result.items[0], kind: "decision" }],
      decisions: [{ itemKey: "first", outcomes: [{ key: "yes", label: "Yes", next: [] }, { key: "no", label: "No", next: [] }] }] }
    const unfinished = createResearchDraft(decisionResult)
    unfinished.decisions[0].outcomes.forEach(outcome => { outcome.label = "" })
    expect(() => validateResearchRecoveryDraft(decisionResult, unfinished)).not.toThrow()
    expect(() => validateResearchRecoveryDraft(decisionResult, unfinished, true)).toThrow()
    expect(() => applyResearchDraft(decisionResult, unfinished)).toThrow()
    const forged = structuredClone(unfinished); forged.decisions[0].outcomes[0].key = "forged"
    expect(() => validateResearchRecoveryDraft(decisionResult, forged)).toThrow()
    unfinished.decisions[0].outcomes[0].label = "x".repeat(241)
    expect(() => validateResearchRecoveryDraft(decisionResult, unfinished)).toThrow()
    unfinished.decisions[0].outcomes[0].label = "Proceed"
    unfinished.decisions[0].outcomes[1].label = "Wait"
    expect(() => applyResearchDraft(decisionResult, unfinished)).not.toThrow()
  })
})
