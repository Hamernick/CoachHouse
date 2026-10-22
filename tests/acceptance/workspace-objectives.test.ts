import { describe, expect, it } from "vitest"

import { mapLegacyTrackerStateToObjectiveCollection } from "@/features/workspace-objectives"

describe("workspace-objectives feature contract", () => {
  it("maps legacy tracker state into objective groups/objectives", () => {
    const now = new Date("2026-02-27T00:00:00.000Z")
    const result = mapLegacyTrackerStateToObjectiveCollection({
      orgId: "org-1",
      actorId: "user-1",
      now,
      state: {
        tracker: {
          categories: [
            { id: "general", title: "General", archived: false, createdAt: "2026-02-20T00:00:00.000Z" },
            { id: "fundraising", title: "Fundraising", archived: false, createdAt: "2026-02-21T00:00:00.000Z" },
          ],
          tickets: [
            {
              id: "ticket-1",
              categoryId: "fundraising",
              title: "Draft donor outreach sequence",
              status: "in_progress",
              archived: false,
              createdAt: "2026-02-22T00:00:00.000Z",
              updatedAt: "2026-02-23T00:00:00.000Z",
            },
          ],
        },
      },
    })

    expect(result.loadedFrom).toBe("legacy_tracker")
    expect(result.groups).toHaveLength(2)
    expect(result.objectives).toHaveLength(1)
    expect(result.objectives[0]?.title).toBe("Draft donor outreach sequence")
    expect(result.objectives[0]?.status).toBe("in_progress")
  })
})

// Real action boundary; database transport is simulated here. Existing table RLS
// remains separately responsible for row access in the authenticated runtime.
import { beforeEach, vi } from "vitest"
import { editIslandObjective, setIslandStep } from "@/features/workspace-objectives/server/island-actions"
const islandMocks = vi.hoisted(() => ({ client: vi.fn(), active: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: islandMocks.client }))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: islandMocks.active, canEditOrganization: (role: string) => ["owner", "admin", "staff"].includes(role) }))
const scope = { userId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002" }
const edit = { id: "00000000-0000-4000-8000-000000000003", title: "Launch a volunteer program", description: "Recruit and train volunteers", status: "in_progress" as const, expectedUpdatedAt: "2026-10-22T12:00:00Z" }
beforeEach(() => {
  vi.clearAllMocks()
  islandMocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: scope.userId } }, error: null }) }, from: islandMocks.from, rpc: islandMocks.rpc })
  islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "owner" })
})
function query(data: unknown) {
  const value = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }
  value.update.mockReturnValue(value); value.eq.mockReturnValue(value); value.select.mockReturnValue(value)
  return value
}
describe("objective island authorization and concurrent edits", () => {
  it("denies another organization and read-only members before any write", async () => {
    expect((await editIslandObjective({ ...scope, organizationId: edit.id }, edit)).ok).toBe(false)
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await editIslandObjective(scope, edit)).ok).toBe(false)
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it("uses the saved revision and custom owner, and reports a stale edit without claiming success", async () => {
    const db = query(null); islandMocks.from.mockReturnValue(db)
    const result = await editIslandObjective(scope, edit)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("changed") })
    expect(db.eq.mock.calls).toEqual([["org_id", scope.organizationId], ["id", edit.id], ["kind", "custom"], ["updated_at", edit.expectedUpdatedAt]])
    db.maybeSingle.mockResolvedValue({ data: { id: edit.id }, error: null })
    expect(await editIslandObjective(scope, { ...edit, status: "done" })).toEqual({ ok: true })
    expect(db.update).toHaveBeenLastCalledWith(expect.objectContaining({ status: "done", completed_at: expect.any(String), updated_by: scope.userId }))
  })
  it("protects source-managed steps and scopes custom step edits to the objective and revision", async () => {
    const parent = query({ kind: "system" }); const step = query({ id: edit.id })
    islandMocks.from.mockReturnValueOnce(parent)
    const input = { id: edit.id, objectiveId: edit.id, expectedUpdatedAt: edit.expectedUpdatedAt, done: true }
    expect((await setIslandStep(scope, input)).ok).toBe(false)
    expect(parent.update).not.toHaveBeenCalled()
    parent.maybeSingle.mockResolvedValue({ data: { kind: "custom" }, error: null })
    islandMocks.from.mockReturnValueOnce(parent).mockReturnValueOnce(step)
    expect(await setIslandStep(scope, input)).toEqual({ ok: true })
    expect(step.eq.mock.calls).toEqual([["org_id", scope.organizationId], ["objective_id", edit.id], ["id", edit.id], ["step_type", "custom"], ["updated_at", edit.expectedUpdatedAt]])
  })
})

import { connectedPlans } from "@/features/workspace-objectives/lib/plan-projection"
import { guardObjectivePlanInteractions } from "@/features/workspace-objectives/lib/plan-flow-guards"
import type { ObjectivePlan } from "@/features/workspace-objectives/plan-types"
describe("objective plan canvas ownership", () => {
  it("expands only explicit links and shared canonical steps, retaining unrelated trees separately", () => {
    const plan = (id: string, stepIds: string[], target?: string): ObjectivePlan => ({ id, title: "Same title", objectiveId: "objective", revision: 1, stepIds, edges: target ? [{ id: `edge-${id}`, source: stepIds[0], target, label: "Approved" }] : [] })
    const plans = [plan("a", ["a-step"], "b-step"), plan("b", ["b-step", "shared"]), plan("c", ["shared"]), plan("d", ["unrelated"])]
    expect(connectedPlans(plans, ["a"]).map(item => item.id)).toEqual(["a", "b", "c"])
    expect(connectedPlans(plans, ["c"]).map(item => item.id)).toEqual(["a", "b", "c"])
    expect(connectedPlans(plans, ["d"]).map(item => item.id)).toEqual(["d"])
    expect(connectedPlans(plans, []).length).toBe(0)
  })
  it("never sends projected plan mutations to the manual canvas store", () => {
    const changes = vi.fn(); const connect = vi.fn()
    const handlers = guardObjectivePlanInteractions({ onNodesChange: changes, onConnect: connect })
    handlers.onNodesChange!([{ type: "remove", id: "objective-plan:step" }, { type: "remove", id: "manual-card" }])
    expect(changes).toHaveBeenCalledWith([{ type: "remove", id: "manual-card" }])
    handlers.onConnect!({ source: "objective-plan:step", target: "manual-card", sourceHandle: null, targetHandle: null })
    expect(connect).not.toHaveBeenCalled()
    expect(handlers.isValidConnection!({ source: "manual-card", target: "objective-plan:step", sourceHandle: null, targetHandle: null })).toBe(false)
  })
})


import { readObjectivePlans, saveObjectivePlan } from "@/features/workspace-objectives/server/plan-actions"
describe("plan server action", () => {
  const draft = { id: edit.id, objectiveId: edit.id, revision: 0, title: "Launch plan", steps: [], edges: [] }
  it("rejects scope and read-only access before calling the database", async () => {
    expect((await saveObjectivePlan({ ...scope, userId: edit.id }, draft)).ok).toBe(false)
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await saveObjectivePlan(scope, draft)).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it("uses the authenticated organization and returns conflicts without claiming a save", async () => {
    islandMocks.rpc.mockResolvedValueOnce({ error: { code: "40001" } }).mockResolvedValueOnce({ error: null })
    expect(await saveObjectivePlan(scope, draft)).toMatchObject({ ok: false, error: expect.stringContaining("changed") })
    expect(await saveObjectivePlan(scope, draft)).toEqual({ ok: true })
    expect(islandMocks.rpc).toHaveBeenCalledWith("save_workspace_objective_plan", { p_org_id: scope.organizationId, p_draft: draft })
  })
})


describe("decision migration compatibility", () => {
  it("reports decision capability even for an empty collection and falls back safely before migration", async () => {
    const client = await islandMocks.client()
    islandMocks.rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await readObjectivePlans(client, scope.organizationId)).toEqual({ available: true, decisionsAvailable: true, plans: [] })
    islandMocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } }).mockResolvedValueOnce({ data: [], error: null })
    expect(await readObjectivePlans(client, scope.organizationId)).toEqual({ available: true, decisionsAvailable: false, plans: [] })
  })
  it("never silently drops decision data on an older deployment", async () => {
    islandMocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } })
    expect((await saveObjectivePlan(scope, { id: edit.id, objectiveId: edit.id, revision: 0, title: "Plan", steps: [], edges: [], decisions: [] })).ok).toBe(false)
    expect(islandMocks.rpc).toHaveBeenCalledWith("save_workspace_objective_plan_v2", expect.any(Object))
  })
})
