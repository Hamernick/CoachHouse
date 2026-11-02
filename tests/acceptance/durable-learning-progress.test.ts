import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseServerClientServerMock, revalidatePathMock } from "./test-utils"
import { saveModuleStepProgressAction } from "@/app/actions/module-step-progress"
import { fetchAcceleratorProgressSummary } from "@/lib/accelerator/progress"
import { readCompletedModuleStepIds } from "@/lib/accelerator/step-progress"
import { buildWorkspaceAcceleratorCardSteps } from "@/features/workspace-accelerator-card/lib"
import { hydrateWorkspaceSeedAcceleratorState } from "@/app/(dashboard)/my-organization/_lib/my-organization-page-content-helpers"
import { mergeNewerPersistedWorkspaceNodeState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-persistence"
import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { buildAssignmentDraft, readAssignmentDraft } from "@/components/training/module-detail/assignment-form/assignment-draft"

const { resolveContext } = vi.hoisted(() => ({ resolveContext: vi.fn() }))
vi.mock("@/lib/accelerator/organization-context", () => ({ resolveOrganizationLearningContext: resolveContext }))

describe("acknowledged learner step progress", () => {
  const rpc = vi.fn()
  let queryError: unknown = null
  let published = true
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) }, rpc,
    from: (table: string) => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ error: queryError, data:
        table === "modules" ? { id: "lesson", slug: "vision", is_published: published, video_url: "https://example.test/video", classes: { is_published: true } } : null,
      }) }
      return query
    },
  }
  beforeEach(() => {
    vi.clearAllMocks(); queryError = null; published = true
    resolveContext.mockResolvedValue({ learningUserId: "owner" })
    rpc.mockResolvedValue({ data: { version: 1, completed: { video: { actorId: "actor", recordedAt: "2026-11-02" } } }, error: null })
    createSupabaseServerClientServerMock.mockResolvedValue(client)
  })
  const save = (stepId = "lesson:video") => saveModuleStepProgressAction({ moduleId: "lesson", stepId, expectedOrgId: "owner" })
  it("binds the organization, writes only the resolved learner, and invalidates after acknowledgement", async () => {
    expect(await save()).toEqual({ ok: true })
    expect(resolveContext).toHaveBeenCalledWith(client, "actor", "owner")
    expect(rpc).toHaveBeenCalledWith("record_module_step", { p_user_id: "owner", p_module_id: "lesson", p_step_key: "video" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/accelerator", "layout")
  })
  it("does not acknowledge an error, an empty receipt, or the wrong step", async () => {
    for (const response of [{ data: null, error: { message: "offline" } }, { data: null, error: null }, { data: { version: 1, completed: { resources: {} } }, error: null }]) {
      rpc.mockResolvedValue(response)
      expect(await save()).toHaveProperty("error")
    }
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
  it("rejects changed organization, unpublished lessons, read failures and nonexistent steps", async () => {
    resolveContext.mockRejectedValueOnce(new Error("scope changed"))
    expect(await save()).toHaveProperty("error")
    published = false; expect(await save()).toHaveProperty("error")
    published = true; queryError = { code: "offline" }; expect(await save()).toHaveProperty("error")
    queryError = null
    for (const id of ["other:video", "lesson:complete", "lesson:assignment:missing", "lesson:resources"]) expect(await save(id)).toHaveProperty("error")
    expect(rpc).not.toHaveBeenCalled()
  })
  it("rehydrates acknowledged partial steps while keeping shared-board markers out", () => {
    const completed = readCompletedModuleStepIds("lesson", { version: 1, completed: { video: {}, "assignment:old": {}, complete: {} } })
    const steps = buildWorkspaceAcceleratorCardSteps([{
      id: "lesson", title: "Vision", description: null, durationMinutes: null, href: "/lesson", status: "not_started", groupTitle: "Planning",
      videoUrl: "https://example.test/video", resources: [], hasAssignment: true, hasDeck: false, completedStepIds: completed,
    }])
    expect(steps.find(step => step.id === "lesson:video")?.status).toBe("completed")
    expect(steps.find(step => step.id === "lesson:assignment")?.status).toBe("not_started")
    expect(steps.find(step => step.id === "lesson:complete")?.status).toBe("not_started")
    const boardState = buildDefaultBoardState()
    boardState.accelerator.completedStepIds = ["someone-else:video"]
    const seed = hydrateWorkspaceSeedAcceleratorState({ boardState }, steps)
    expect(seed.boardState.accelerator.completedStepIds).toEqual(["lesson:video"])
  })
  it("preserves historical board markers as evidence across a newer partial save", () => {
    const persisted = buildDefaultBoardState()
    const incoming = buildDefaultBoardState()
    persisted.accelerator.completedStepIds = ["old:video"]
    incoming.accelerator.completedStepIds = ["new:video"]
    const merged = mergeNewerPersistedWorkspaceNodeState({ incoming, persisted })
    expect(new Set(merged.accelerator.completedStepIds)).toEqual(new Set(["old:video", "new:video"]))
    expect(incoming.accelerator.completedStepIds).toEqual(["new:video"])
  })
  it("reports a failed learner read instead of returning a zero-progress success", async () => {
    const supabase = { from: () => {
      const query = { select: () => query, eq: () => query, in: () => query, returns: async () => ({ data: null, error: { message: "offline" } }) }
      return query
    } } as never
    const classes = [{ id: "class", slug: "formation", title: "Formation", description: null, published: true, modules: [{ id: "lesson", index: 1, title: "Start", description: null, published: true }] }]
    await expect(fetchAcceleratorProgressSummary({ supabase, classes, userId: "owner", isAdmin: false })).rejects.toThrow()
  })
  it("ignores unsupported or malformed stored progress", () => {
    for (const value of [null, [], { version: 2, completed: { video: {} } }, { version: 1, completed: [] }]) expect(readCompletedModuleStepIds("lesson", value)).toEqual([])
  })
  it("does not restore a scoped assignment draft under a different actor, organization or module", () => {
    const initialValues = { answer: "" }
    const raw = buildAssignmentDraft({ initialValues, values: { answer: "Kept draft" }, scope: "org:actor", moduleId: "lesson" })
    expect(readAssignmentDraft({ initialValues, raw, scope: "org:actor", moduleId: "lesson" })).toEqual({ answer: "Kept draft" })
    for (const scope of ["other:actor", "org:other"]) expect(readAssignmentDraft({ initialValues, raw, scope, moduleId: "lesson" })).toBeNull()
    expect(readAssignmentDraft({ initialValues, raw, scope: "org:actor", moduleId: "other" })).toBeNull()
  })
})
