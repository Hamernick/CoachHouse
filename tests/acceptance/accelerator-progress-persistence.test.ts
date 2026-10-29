import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { toast } from "sonner"
import { useWorkspaceAcceleratorCompletion } from "@/features/workspace-accelerator-card/hooks/use-workspace-accelerator-completion"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { markModuleCompleteAction } from "@/app/actions/module-progress"
import { fetchAcceleratorProgressSummary, fetchAcceleratorProgressTotalsByUserId } from "@/lib/accelerator/progress"
import { createSupabaseServerClientServerMock, revalidatePathMock } from "./test-utils"

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: async (_client: unknown, id: string) => ({ orgId: id, role: "owner" }),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

type CompletionInput = Parameters<typeof useWorkspaceAcceleratorCompletion>[0]
function createCompletion(input: CompletionInput) {
  let completion!: ReturnType<typeof useWorkspaceAcceleratorCompletion>
  function Harness() {
    completion = useWorkspaceAcceleratorCompletion(input)
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  return completion
}

function completionController() {
  const markCurrentStepComplete = vi.fn()
  return {
    markCurrentStepComplete,
    controller: {
      currentStep: { moduleId: "lesson" },
      currentModuleSteps: [{ stepKind: "video" }],
      markCurrentStepComplete,
    } as unknown as CompletionInput["controller"],
  }
}

describe("durable accelerator progress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(["completeModule", "completeVideo"] as const)(
    "does not claim completion from %s without a persistence handler",
    async (method) => {
      const { controller, markCurrentStepComplete } = completionController()
      const completion = createCompletion({ controller, onModuleComplete: undefined })
      const result = await completion[method]()
      if (method === "completeModule") expect(result).toBe(false)
      expect(markCurrentStepComplete).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith("Unable to save lesson progress. Reload and try again.")
    },
  )

  it("marks completion only after persistence succeeds and allows retry after failure", async () => {
    const { controller, markCurrentStepComplete } = completionController()
    const onModuleComplete = vi.fn()
      .mockResolvedValueOnce({ error: "offline" })
      .mockResolvedValueOnce({ ok: true })
    const completion = createCompletion({ controller, onModuleComplete })
    expect(await completion.completeModule()).toBe(false)
    expect(markCurrentStepComplete).not.toHaveBeenCalled()
    expect(await completion.completeModule()).toBe(true)
    expect(onModuleComplete).toHaveBeenLastCalledWith("lesson")
    expect(markCurrentStepComplete).toHaveBeenCalledExactlyOnceWith(true)
  })

  it("reports completion write failures and invalidates overviews only after success", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "offline" } })
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) },
      from: () => ({ upsert }),
    })
    expect(await markModuleCompleteAction("lesson")).toHaveProperty("error")
    expect(revalidatePathMock).not.toHaveBeenCalled()
    upsert.mockResolvedValue({ error: null })
    expect(await markModuleCompleteAction("lesson")).toEqual({ ok: true })
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: "viewer", module_id: "lesson", status: "completed" }), { onConflict: "user_id,module_id" })
    expect(revalidatePathMock).toHaveBeenCalledWith("/workspace", "layout")
    expect(revalidatePathMock).toHaveBeenCalledWith("/accelerator", "layout")
  })

  it("shows completed assignments despite an older in-progress row in both summaries", async () => {
    const rows: Record<string, unknown[]> = {
      module_progress: [{ user_id: "viewer", module_id: "lesson", status: "in_progress", notes: null }],
      assignment_submissions: [{ user_id: "viewer", module_id: "lesson", status: "accepted", answers: {} }],
      module_assignments: [{ module_id: "lesson", complete_on_submit: true, schema: { fields: [] } }],
    }
    const supabase = { from: (table: string) => {
      const query = { select: () => query, eq: () => query, in: () => query, returns: async () => ({ data: rows[table], error: null }) }
      return query
    } } as never
    const classes = [{ id: "class", slug: "formation", title: "Formation", description: null, published: true, modules: [{ id: "lesson", index: 1, title: "Start with your why", description: null, published: true }] }]
    const summary = await fetchAcceleratorProgressSummary({ supabase, classes, userId: "viewer", isAdmin: false })
    expect(summary.groups[0].modules[0].status).toBe("completed")
    expect(summary.completedModules).toBe(1)
    const totals = await fetchAcceleratorProgressTotalsByUserId({ supabase, classes, userIds: ["viewer"] })
    expect(totals.get("viewer")?.completedModules).toBe(1)
  })
})
