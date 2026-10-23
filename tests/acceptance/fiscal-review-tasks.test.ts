import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn(), user: vi.fn(), ordinary: vi.fn(), revalidate: vi.fn(), scope: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }))
vi.mock("@/server/auth/server-user", () => ({ getServerUser: mocks.user }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("@/features/member-workspace/server/task-actions", () => ({ updateMemberWorkspaceTaskStatusAction: mocks.ordinary }))
vi.mock("@/features/member-workspace/server/task-directory-scope", () => ({ resolveDirectoryTaskScope: mocks.scope }))
import { loadFiscalReviewTasks, updateFiscalReviewTaskStatus } from "@/features/member-workspace/server/fiscal-review-tasks"
import { updateDirectoryTaskStatusAction } from "@/features/member-workspace/server/fiscal-review-task-actions"
const id = "10000000-0000-4000-8000-000000000001"
const projectId = "10000000-0000-4000-8000-000000000002"
const task = { id, projectId, projectName: "Community garden", title: "Review fiscal sponsorship application", description: "Shared review", status: "todo", reviewers: ["Joel", "Caleb", "Karissa"] }
beforeEach(() => {
 vi.resetAllMocks()
 mocks.admin.mockReturnValue({ rpc: mocks.rpc })
 mocks.user.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
 mocks.rpc.mockResolvedValue({ data: { ok: true, projectId }, error: null })
 mocks.scope.mockResolvedValue("workspace")
})
describe("shared fiscal review tasks", () => {
 it.each(["Joel", "Caleb", "Karissa"])("shows one task assigned to the signed-in %s without exposing host data", async (name) => {
  mocks.rpc.mockResolvedValue({ data: [task], error: null })
  const tasks = await loadFiscalReviewTasks({ id: name, name })
  expect(tasks).toHaveLength(1)
  expect(tasks[0]).toMatchObject({ id, assignee: { id: name, name }, projectMembers: task.reviewers, canUpdate: false })
  expect(mocks.admin).toHaveBeenCalledWith({ actorId: name })
  expect(mocks.rpc).toHaveBeenCalledWith("list_fiscal_review_tasks", { p_user_id: name })
 })
 it("allows staged migration absence but fails closed on other task load failures", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
  expect(await loadFiscalReviewTasks({ id, name: "Caleb" })).toEqual([])
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
  await expect(loadFiscalReviewTasks({ id, name: "Caleb" })).rejects.toThrow("Unable to load")
 })
 it("binds a shared task update to Auth and revalidates its task/project pages", async () => {
  expect(await updateDirectoryTaskStatusAction(id, "done")).toEqual({ ok: true, taskId: id, status: "done" })
  expect(mocks.rpc).toHaveBeenCalledWith("update_fiscal_review_task_status", { p_task_id: id, p_user_id: "verified-user", p_status: "done" })
  expect(mocks.ordinary).not.toHaveBeenCalled()
  expect(mocks.revalidate).toHaveBeenCalledWith("/tasks")
  expect(mocks.revalidate).toHaveBeenCalledWith(`/projects/${projectId}`)
 })
 it("rejects invalid task IDs before authentication or database work", async () => {
  expect(await updateDirectoryTaskStatusAction("bad", "done")).toHaveProperty("error")
  expect(mocks.user).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("rejects unauthenticated requests without elevated access", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null })
  expect(await updateDirectoryTaskStatusAction(id, "done")).toHaveProperty("error")
  expect(mocks.admin).not.toHaveBeenCalled()
 })
 it.each([{ data: { ok: false }, error: null }, { data: null, error: { code: "08006" } }])("does not fall through on revoked assignment or uncertain RPC failure", async (response) => {
  mocks.rpc.mockResolvedValue(response)
  expect(await updateDirectoryTaskStatusAction(id, "done")).toHaveProperty("error")
  expect(mocks.ordinary).not.toHaveBeenCalled()
  expect(mocks.revalidate).not.toHaveBeenCalled()
 })
 it("retains ordinary task authorization when no fiscal task matches", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.ordinary.mockResolvedValue({ error: "Organization access required" })
  expect(await updateDirectoryTaskStatusAction(id, "done")).toEqual({ error: "Organization access required" })
  expect(mocks.ordinary).toHaveBeenCalledWith(id, "done", "workspace")
 })
 it.each(["workspace", "platform"])("allows ordinary Waiting through the verified %s scope", async (scope) => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.scope.mockResolvedValue(scope)
  mocks.ordinary.mockResolvedValue({ ok: true, taskId: id, status: "waiting" })
  expect(await updateDirectoryTaskStatusAction(id, "waiting")).toEqual({ ok: true, taskId: id, status: "waiting" })
  expect(mocks.ordinary).toHaveBeenCalledWith(id, "waiting", scope)
 })
 it("does not fall through to ordinary editing when fiscal Waiting is denied", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: false }, error: null })
  expect(await updateDirectoryTaskStatusAction(id, "waiting")).toHaveProperty("error")
  expect(mocks.rpc).toHaveBeenCalledWith("update_fiscal_review_task_status", { p_task_id: id, p_user_id: "verified-user", p_status: "waiting" })
  expect(mocks.ordinary).not.toHaveBeenCalled()
  expect(mocks.scope).not.toHaveBeenCalled()
  expect(mocks.revalidate).not.toHaveBeenCalled()
 })
 it("retains ordinary authorization when the new RPC is not yet deployed", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
  expect(await updateFiscalReviewTaskStatus(id, "verified-user", "todo")).toBeNull()
 })
})
