import { describe, expect, it, vi } from "vitest"
import { getClassModulesForUser } from "@/lib/modules/service"

const mocks = vi.hoisted(() => ({ layout: vi.fn(), content: vi.fn() }))
vi.mock("@/lib/auth/request-context", () => ({ resolveOptionalAuthenticatedAppContext: vi.fn().mockResolvedValue(null) }))
vi.mock("@/components/app-shell/dashboard-layout-state", () => ({ resolveDashboardLayoutState: mocks.layout }))
vi.mock("@/app/(dashboard)/my-organization/_lib/my-organization-page-content", () => ({ default: mocks.content }))
vi.mock("@/lib/performance/server-timing", () => ({ measureServerStep: (_name: string, work: () => unknown) => work() }))
import WorkspacePage from "@/app/(dashboard)/workspace/page"

describe("workspace loading", () => {
  it("starts authenticated page content while layout data is still pending", async () => {
    let release!: (value: { userPresent: boolean; isAdmin: boolean }) => void
    mocks.layout.mockReturnValue(new Promise(resolve => { release = resolve }))
    mocks.content.mockResolvedValue("workspace content")
    const page = WorkspacePage({})
    expect(mocks.content).toHaveBeenCalledOnce()
    release({ userPresent: true, isAdmin: true })
    expect(await page).toBe("workspace content")
  })

  it("skips unused progress queries while preserving published lesson content", async () => {
    const classRow = { id: "class", title: "Formation", is_published: true, modules: [
      { id: "lesson", idx: 1, slug: "lesson", title: "Lesson", is_published: true, content_md: "Notes" },
      { id: "draft", idx: 2, slug: "draft", title: "Draft", is_published: false },
    ] }
    const tables: string[] = []
    const from = (table: string) => {
      tables.push(table)
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain,
        maybeSingle: async () => ({ data: classRow, error: null }),
        returns: async () => ({ data: table === "module_progress" ? [{ module_id: "lesson", status: "completed" }] : [], error: null }),
      }
      return chain
    }
    const args = { classSlug: "formation", userId: "viewer", supabase: { from } as never }
    const complete = await getClassModulesForUser(args)
    expect(tables).toContain("module_progress")
    tables.length = 0
    const timeline = await getClassModulesForUser({ ...args, includeProgress: false })
    expect(tables).not.toContain("module_progress")
    expect(timeline.modules).toEqual(complete.modules)
    expect(timeline.modules.map(module => module.id)).toEqual(["lesson"])
    expect(timeline.modules[0].contentMd).toBe("Notes")
    expect(timeline.progressMap).toEqual({})
    expect(complete.progressMap.lesson).toBe("completed")
  })
})
