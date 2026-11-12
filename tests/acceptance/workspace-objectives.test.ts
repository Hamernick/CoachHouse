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
  it("sends the displayed revision and only editable objective fields to the authenticated writer", async () => {
    islandMocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await editIslandObjective(scope, edit)).toEqual({ ok: true })
    expect(islandMocks.rpc).toHaveBeenCalledExactlyOnceWith("write_workspace_objective_island", {
      p_org_id: scope.organizationId, p_objective_id: edit.id, p_step_id: null,
      p_expected_updated_at: edit.expectedUpdatedAt, p_title: edit.title,
      p_description: edit.description, p_status: edit.status,
    })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it.each([true, false])("sends the parent, step revision and completion state (%s) without a racy parent pre-read", async done => {
    islandMocks.rpc.mockResolvedValue({ data: true, error: null })
    const id = "00000000-0000-4000-8000-000000000004"
    expect(await setIslandStep(scope, { id, objectiveId: edit.id, expectedUpdatedAt: edit.expectedUpdatedAt, done })).toEqual({ ok: true })
    expect(islandMocks.rpc).toHaveBeenCalledExactlyOnceWith("write_workspace_objective_island", {
      p_org_id: scope.organizationId, p_objective_id: edit.id, p_step_id: id,
      p_expected_updated_at: edit.expectedUpdatedAt, p_title: null, p_description: null,
      p_status: done ? "done" : "todo",
    })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  for (const mode of ["objective", "step"] as const) {
    const save = () => mode === "objective" ? editIslandObjective(scope, edit) : setIslandStep(scope, { id: edit.id, objectiveId: edit.id, expectedUpdatedAt: edit.expectedUpdatedAt, done: true })
    it.each([
      [{ code: "40001", message: "private database detail" }, "changed"],
      [{ code: "42501", message: "private database detail" }, "source"],
      [{ code: "57014", message: "private database detail" }, "confirm"],
    ] as const)(`${mode}: rejects conflict, source/authority denial and unknown failures without retry (%j)`, async (error, text) => {
      islandMocks.rpc.mockResolvedValue({ data: null, error })
      const result = await save()
      expect(result).toMatchObject({ ok: false, error: expect.stringContaining(text) })
      expect(JSON.stringify(result)).not.toContain("private database detail")
      expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
      expect(islandMocks.from).not.toHaveBeenCalled()
    })
    it.each([null, false, {}, "true"])(`${mode}: does not claim success for an ambiguous acknowledgment (%j)`, async data => {
      islandMocks.rpc.mockResolvedValue({ data, error: null })
      expect(await save()).toMatchObject({ ok: false, error: expect.stringContaining("confirm") })
      expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
    })
    it(`${mode}: rejects revoked or switched actors before dispatch`, async () => {
      islandMocks.active.mockResolvedValue({ orgId: edit.id, role: "owner" })
      expect((await save()).ok).toBe(false)
      islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
      expect((await save()).ok).toBe(false)
      expect(islandMocks.rpc).not.toHaveBeenCalled()
    })
  }
  it("rejects invalid edits before dispatch", async () => {
    expect((await editIslandObjective(scope, { ...edit, title: " " })).ok).toBe(false)
    expect((await setIslandStep(scope, { id: "invalid", objectiveId: edit.id, expectedUpdatedAt: edit.expectedUpdatedAt, done: true })).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
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


import { setWorkspaceObjectiveAssigneesAction } from "@/app/(dashboard)/my-organization/_lib/workspace-objectives-actions"
describe("legacy objective assignment replacement", () => {
  it("rejects read-only users before reading or replacing assignments", async () => {
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await setWorkspaceObjectiveAssigneesAction({ objectiveId: edit.id, userIds: [] })).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it("replaces a normalized selection with one authenticated RPC and the read revision", async () => {
    const db = query({ updated_at: edit.expectedUpdatedAt }); islandMocks.from.mockReturnValue(db)
    islandMocks.rpc.mockResolvedValue({ data: [scope.userId], error: null })
    expect(await setWorkspaceObjectiveAssigneesAction({ objectiveId: edit.id, userIds: [scope.userId, ` ${scope.userId} `, ""] })).toEqual({ ok: true, data: { objectiveId: edit.id, userIds: [scope.userId] } })
    expect(islandMocks.rpc).toHaveBeenCalledWith("replace_workspace_objective_assignees", {
      p_org_id: scope.organizationId, p_objective_id: edit.id, p_expected_updated_at: edit.expectedUpdatedAt, p_user_ids: [scope.userId],
    })
    expect(islandMocks.from).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
  })
  it("supports an intentional empty selection", async () => {
    islandMocks.from.mockReturnValue(query({ updated_at: edit.expectedUpdatedAt }))
    islandMocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await setWorkspaceObjectiveAssigneesAction({ objectiveId: edit.id, userIds: [] })).toEqual({ ok: true, data: { objectiveId: edit.id, userIds: [] } })
  })
  it.each(["40001", "42501", "23503"])("reports %s without retrying or claiming a save", async code => {
    islandMocks.from.mockReturnValue(query({ updated_at: edit.expectedUpdatedAt }))
    islandMocks.rpc.mockResolvedValue({ data: null, error: { code } })
    expect(await setWorkspaceObjectiveAssigneesAction({ objectiveId: edit.id, userIds: [scope.userId] })).toMatchObject({ ok: false, error: expect.stringContaining(code === "40001" ? "changed" : "confirm") })
    expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
  })
})

import * as routeGroups from "@/app/(dashboard)/my-organization/_lib/workspace-objectives-actions"
import * as featureGroups from "@/features/workspace-objectives/server/actions"

describe.each([["route", routeGroups], ["feature", featureGroups]] as const)("%s category writes", (_, actions) => {
  const group = { id: edit.id, org_id: scope.organizationId, title: "Team", kind: "custom", source_type: "none", archived_at: null, created_by: scope.userId, created_at: edit.expectedUpdatedAt, updated_at: edit.expectedUpdatedAt }
  const archive = { groupId: edit.id, archived: true, expectedUpdatedAt: edit.expectedUpdatedAt }
  function result(data: unknown, error: unknown = null) {
    islandMocks.rpc.mockReturnValue({ returns: vi.fn().mockResolvedValue({ data, error }) })
  }
  it("creates through authenticated admission, using only normalized input", async () => {
    result(group)
    expect(await actions.createWorkspaceObjectiveGroupAction({ title: " Team " })).toMatchObject({ ok: true, data: { id: edit.id, title: "Team" } })
    expect(islandMocks.rpc).toHaveBeenCalledWith("write_workspace_objective_group", { p_org_id: scope.organizationId, p_group_id: null, p_expected_updated_at: null, p_title: "Team", p_archived: null })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it("uses the displayed revision and the committed archive state", async () => {
    result({ ...group, archived_at: edit.expectedUpdatedAt })
    expect(await actions.setWorkspaceObjectiveGroupArchivedAction(archive)).toEqual({ ok: true, data: { groupId: edit.id, archived: true } })
    expect(islandMocks.rpc).toHaveBeenCalledWith("write_workspace_objective_group", { p_org_id: scope.organizationId, p_group_id: edit.id, p_expected_updated_at: edit.expectedUpdatedAt, p_title: null, p_archived: true })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it("rejects missing revisions before sending a write", async () => {
    expect((await actions.setWorkspaceObjectiveGroupArchivedAction({ ...archive, expectedUpdatedAt: "" })).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it("never reports success when no matching row was committed", async () => {
    result(null)
    expect((await actions.setWorkspaceObjectiveGroupArchivedAction(archive)).ok).toBe(false)
    result({ ...group, id: "another-group" })
    expect((await actions.setWorkspaceObjectiveGroupArchivedAction(archive)).ok).toBe(false)
  })
  it.each(["40001", "42501", "23505"])("does not retry a conflict, denial or uniqueness failure (%s)", async (code) => {
    result(null, { code })
    const response = await actions.setWorkspaceObjectiveGroupArchivedAction(archive)
    expect(response.ok).toBe(false)
    if (code === "40001") expect(response).toMatchObject({ error: expect.stringContaining("changed") })
    expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("denies read-only creation and archive before RPC", async () => {
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await actions.createWorkspaceObjectiveGroupAction({ title: "Team" })).ok).toBe(false)
    expect((await actions.setWorkspaceObjectiveGroupArchivedAction(archive)).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
})

const objectiveRow = { id: edit.id, org_id: scope.organizationId, group_id: null, title: "Review documents", description: null, status: "todo", priority: "normal", kind: "custom", source_type: "custom", source_key: null, due_at: null, completed_at: null, position_rank: 0, created_by: scope.userId, updated_by: scope.userId, created_at: edit.expectedUpdatedAt, updated_at: "2026-11-06T12:00:00.123456Z" }
function objectiveResult(data: unknown, error: unknown = null) {
  islandMocks.rpc.mockReturnValue({ returns: vi.fn().mockResolvedValue({ data, error }) })
}
const statusInput = { objectiveId: edit.id, expectedUpdatedAt: "2026-11-06T11:00:00.123456Z", status: "done" as const }
describe.each([["route", routeGroups], ["feature", featureGroups]] as const)("%s legacy objective writes", (_, actions) => {
  it("creates the objective and initial assignments in one authenticated call", async () => {
    objectiveResult(objectiveRow)
    expect(await actions.createWorkspaceObjectiveAction({ title: " Review documents ", userIds: [scope.userId] })).toMatchObject({ ok: true, data: { id: edit.id, updatedAt: objectiveRow.updated_at } })
    expect(islandMocks.rpc).toHaveBeenCalledExactlyOnceWith("write_workspace_objective", {
      p_mode: "create", p_org_id: scope.organizationId, p_objective_id: null, p_expected_updated_at: null,
      p_title: "Review documents", p_description: null, p_priority: "normal", p_due_at: null,
      p_group_id: null, p_status: null, p_user_ids: [scope.userId],
    })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it("uses the displayed revision without rounding timestamp precision", async () => {
    objectiveResult({ ...objectiveRow, status: "done", completed_at: objectiveRow.updated_at })
    expect(await actions.setWorkspaceObjectiveStatusAction(statusInput)).toMatchObject({ ok: true, data: { status: "done", completedAt: objectiveRow.updated_at } })
    expect(islandMocks.rpc).toHaveBeenCalledExactlyOnceWith("write_workspace_objective", {
      p_mode: "status", p_org_id: scope.organizationId, p_objective_id: edit.id, p_expected_updated_at: statusInput.expectedUpdatedAt,
      p_title: null, p_description: null, p_priority: null, p_due_at: null, p_group_id: null, p_status: "done", p_user_ids: null,
    })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it.each(["", "invalid"])("rejects invalid revision %s without writing", async revision => {
    expect((await actions.setWorkspaceObjectiveStatusAction({ ...statusInput, expectedUpdatedAt: revision })).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it.each([null, { ...objectiveRow, id: "another-objective" }, { ...objectiveRow, org_id: "another-org" }])("rejects a missing or unrelated committed row", async data => {
    objectiveResult(data)
    expect((await actions.setWorkspaceObjectiveStatusAction(statusInput)).ok).toBe(false)
  })
  it.each(["40001", "42501", "23503"])("reports %s without retries or false success", async code => {
    objectiveResult(null, { code })
    const result = await actions.setWorkspaceObjectiveStatusAction(statusInput)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(code === "40001" ? "changed" : "confirm") })
    expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("does not retry unknown creation outcomes", async () => {
    objectiveResult(null, { code: "NETWORK_ERROR" })
    expect(await actions.createWorkspaceObjectiveAction({ title: "Review" })).toMatchObject({ ok: false, error: expect.stringContaining("confirm") })
    expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
  })
  it("rejects read-only create and status changes before RPC", async () => {
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await actions.createWorkspaceObjectiveAction({ title: "Review" })).ok).toBe(false)
    expect((await actions.setWorkspaceObjectiveStatusAction(statusInput)).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
})
describe("legacy objective editor atomic save", () => {
  const details = { objectiveId: edit.id, expectedUpdatedAt: statusInput.expectedUpdatedAt, title: " Review documents ", description: " Updated ", priority: "high" as const, dueAt: null, groupId: null, userIds: [scope.userId] }
  it("sends edited fields and assignees in one transaction with the opened revision", async () => {
    objectiveResult(objectiveRow)
    expect((await routeGroups.setWorkspaceObjectiveDetailsAction(details)).ok).toBe(true)
    expect(islandMocks.rpc).toHaveBeenCalledExactlyOnceWith("write_workspace_objective", {
      p_mode: "details", p_org_id: scope.organizationId, p_objective_id: edit.id, p_expected_updated_at: details.expectedUpdatedAt,
      p_title: "Review documents", p_description: "Updated", p_priority: "high", p_due_at: null,
      p_group_id: null, p_status: null, p_user_ids: [scope.userId],
    })
    expect(islandMocks.from).not.toHaveBeenCalled()
  })
  it("distinguishes clearing assignments from leaving them unchanged", async () => {
    objectiveResult(objectiveRow)
    await routeGroups.setWorkspaceObjectiveDetailsAction({ ...details, userIds: [] })
    expect(islandMocks.rpc).toHaveBeenLastCalledWith("write_workspace_objective", expect.objectContaining({ p_user_ids: [] }))
    await routeGroups.setWorkspaceObjectiveDetailsAction({ ...details, userIds: undefined })
    expect(islandMocks.rpc).toHaveBeenLastCalledWith("write_workspace_objective", expect.objectContaining({ p_user_ids: null }))
  })
  it("rejects missing revision and read-only editor without writing", async () => {
    expect((await routeGroups.setWorkspaceObjectiveDetailsAction({ ...details, expectedUpdatedAt: "" })).ok).toBe(false)
    islandMocks.active.mockResolvedValue({ orgId: scope.organizationId, role: "board" })
    expect((await routeGroups.setWorkspaceObjectiveDetailsAction(details)).ok).toBe(false)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it.each(["40001", "42501", "23503"])("does not claim a partial save on %s", async code => {
    objectiveResult(null, { code })
    expect((await routeGroups.setWorkspaceObjectiveDetailsAction(details)).ok).toBe(false)
    expect(islandMocks.rpc).toHaveBeenCalledTimes(1)
  })
})

// Exercise both production entry points; failures must not masquerade as an
// empty collection that the tracker would persist over existing work.
describe.each([["route", routeGroups], ["feature", featureGroups]] as const)("%s objective reads", (_, actions) => {
  const tables = ["organization_workspace_objective_groups", "organization_workspace_objectives", "organization_workspace_objective_assignees", "organization_workspace_objective_links"]
  const boardTable = "organization_workspace_boards"
  type ReadResult = { data: unknown; error: unknown }
  let responses: Record<string, ReadResult>
  const legacyState = { tracker: { categories: [{ id: "general", title: "General", archived: false, createdAt: edit.expectedUpdatedAt }], tickets: [{ id: "legacy-ticket", categoryId: "general", title: "Keep legacy work", status: "todo", archived: false, createdAt: edit.expectedUpdatedAt, updatedAt: edit.expectedUpdatedAt }] } }
  const fail = (table: string, code: string, message = `Read failed for ${table}`) => { responses[table] = { data: null, error: { code, message } } }
  beforeEach(() => {
    responses = Object.fromEntries(tables.map(table => [table, { data: [], error: null }]))
    responses[boardTable] = { data: { state: legacyState }, error: null }
    islandMocks.from.mockImplementation((table: string) => {
      const db = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: string) => {
          expect(column).toBe("org_id"); expect(value).toBe(scope.organizationId)
          return db
        }),
        order: vi.fn().mockReturnThis(),
        returns: async () => responses[table],
        maybeSingle: async () => responses[table],
      }
      return db
    })
  })
  it.each(tables)("does not treat permission denial mentioning %s as missing schema", async table => {
    fail(table, "42501", `permission denied for table ${table}`)
    expect(await actions.loadWorkspaceObjectivesAction()).toEqual({ ok: false, error: "Unable to load objectives." })
    expect(islandMocks.from).not.toHaveBeenCalledWith(boardTable)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it.each(["57014", "NETWORK_ERROR", "PGRST204"])("never falls back on %s", async code => {
    fail(tables[1], code)
    expect((await actions.loadWorkspaceObjectivesAction()).ok).toBe(false)
    expect(islandMocks.from).not.toHaveBeenCalledWith(boardTable)
  })
  it.each([
    ["42P01", 'relation "public.organization_workspace_objectives" does not exist'],
    ["PGRST205", "Could not find the table 'public.organization_workspace_objectives' in the schema cache"],
  ])("retains genuine %s migration compatibility through the actor's board read", async (code, message) => {
    fail(tables[1], code, message)
    const loaded = await actions.loadWorkspaceObjectivesAction()
    expect(loaded).toMatchObject({ ok: true, data: { loadedFrom: "legacy_tracker", objectives: [{ title: "Keep legacy work" }] } })
    expect(islandMocks.from).toHaveBeenCalledWith(boardTable)
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it("does not hide another read failure behind a genuine missing table", async () => {
    fail(tables[0], "42P01", `relation "${tables[0]}" does not exist`)
    fail(tables[2], "42501")
    expect((await actions.loadWorkspaceObjectivesAction()).ok).toBe(false)
    expect(islandMocks.from).not.toHaveBeenCalledWith(boardTable)
  })
  it.each(["", "_archive"])("rejects unidentified or unrelated missing-table errors: %s", async suffix => {
    fail(tables[1], "42P01", suffix ? `relation "${tables[1]}${suffix}" does not exist` : "relation unavailable")
    expect((await actions.loadWorkspaceObjectivesAction()).ok).toBe(false)
    expect(islandMocks.from).not.toHaveBeenCalledWith(boardTable)
  })
  it.each([false, true])("returns an error after denied board read, missing schema=%s", async missing => {
    if (missing) fail(tables[1], "42P01", `relation "${tables[1]}" does not exist`)
    fail(boardTable, "42501", "Board source access required.")
    expect(await actions.loadWorkspaceObjectivesAction()).toEqual({ ok: false, error: "Unable to load objectives." })
    expect(islandMocks.rpc).not.toHaveBeenCalled()
  })
  it("preserves legacy work when normalized objectives have not been populated", async () => {
    expect(await actions.loadWorkspaceObjectivesAction()).toMatchObject({ ok: true, data: { loadedFrom: "legacy_tracker", objectives: [{ title: "Keep legacy work" }] } })
  })
  it("allows a genuinely empty collection only after a successful board read", async () => {
    responses[boardTable] = { data: null, error: null }
    expect(await actions.loadWorkspaceObjectivesAction()).toMatchObject({ ok: true, data: { loadedFrom: "normalized", objectives: [] } })
  })
  it("uses populated normalized objectives without reading legacy content", async () => {
    responses[tables[1]] = { data: [objectiveRow], error: null }
    expect(await actions.loadWorkspaceObjectivesAction()).toMatchObject({ ok: true, data: { loadedFrom: "normalized", objectives: [{ id: objectiveRow.id }] } })
    expect(islandMocks.from).not.toHaveBeenCalledWith(boardTable)
  })
})
