import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyAiPlan } from "@/features/workspace-objectives/server/ai-plan-actions"
const mocks = vi.hoisted(() => ({ read: vi.fn(), document: vi.fn(), rpc: vi.fn() }))
vi.mock("@/features/workspace-objectives/server/ai-plan-context", () => ({ loadAiPlan: mocks.read }))
vi.mock("@/features/workspace-ai/generation", () => ({ loadAiDocument: mocks.document }))
vi.mock("@/features/ai-credits", () => ({}))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const target = { userId: id(1), organizationId: id(2), objectiveId: id(3), revision: "2026-10-22T12:00:00Z" }
const document = { sectionId: "vision", title: "Vision", revision: target.revision }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ userId: target.userId, orgId: target.organizationId, proposal: { document }, client: { rpc: mocks.rpc } })
  mocks.document.mockResolvedValue({ section: { content: "Vision" } })
  mocks.rpc.mockResolvedValue({ data: { run_id: id(4), plan_id: id(4), saved_at: target.revision, undone_at: null }, error: null })
})
describe("source-aware plan approval", () => {
  it("reauthorizes and checks the saved source before applying", async () => {
    await applyAiPlan(id(4), target)
    expect(mocks.document).toHaveBeenCalledWith({ ...document, userId: target.userId, organizationId: target.organizationId })
    expect(mocks.document.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0])
  })
  it("prevents approval after access loss or source edits", async () => {
    for (const error of ["Access revoked", "Source changed"]) {
      mocks.document.mockRejectedValueOnce(new Error(error))
      await expect(applyAiPlan(id(4), target)).rejects.toThrow(error)
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("keeps guarded undo available when the source has changed", async () => {
    await applyAiPlan(id(4), target, true)
    expect(mocks.document).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith("undo_workspace_ai_plan", { p_org_id: target.organizationId, p_id: id(4) })
  })
})
