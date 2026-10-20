import { describe, expect, it } from "vitest"
import { readTaskViewState, writeTaskViewState } from "@/features/member-workspace/lib/task-view-state"
import { patchTaskGroups } from "@/features/member-workspace/components/tasks/use-task-mutations"
import type { MemberWorkspaceTaskGroup } from "@/features/member-workspace/types"

describe("task URL state", () => {
  it("round trips view, relation, filters and weekend while preserving unrelated query state", () => {
    const params = new URLSearchParams("source=project")
    const state = { view: "board" as const, relation: "collaborating" as const, week: "2026-10-19", weekend: true, filters: [{ key: "Status", value: "Waiting" }, { key: "Tag", value: "Program & outreach" }] }
    const next = writeTaskViewState(params, state)
    expect(next.get("source")).toBe("project")
    expect(readTaskViewState(next)).toEqual(state)
    expect(params.toString()).toBe("source=project")
  })
  it("falls back from invalid URLs without introducing fixture member assumptions", () => {
    const params = new URLSearchParams({ taskView: "timeline", taskRelation: "everyone", taskWeek: "2026-02-30", taskFilters: JSON.stringify([{ key: "Member", value: "Current member" }, { key: "admin", value: "all" }, { key: "Tag", value: "Safe" }]) })
    expect(readTaskViewState(params, new Date(2026, 9, 20))).toEqual({ view: "list", relation: "owned", week: "2026-10-19", weekend: false, filters: [{ key: "Tag", value: "Safe" }] })
    params.set("taskFilters", "not json")
    expect(readTaskViewState(params).filters).toEqual([])
  })
  it.each(["America/New_York", "Pacific/Honolulu", "Asia/Tokyo"])("restores the same calendar week through DST in %s", timezone => {
    const previous = process.env.TZ
    process.env.TZ = timezone
    try {
      expect(readTaskViewState(new URLSearchParams("taskWeek=2026-11-01")).week).toBe("2026-10-26")
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  })
})

it("reconciles one confirmed field without replacing other task saves or metadata", () => {
  const groups = [{ projectId: "one", tasks: [{ id: "a", title: "Concurrent title", status: "todo", tracker: { provenance: "keep" } }, { id: "b", status: "done" }] }] as unknown as MemberWorkspaceTaskGroup[]
  const next = patchTaskGroups(groups, "a", { status: "done" })
  expect(next[0].tasks[0]).toEqual({ id: "a", title: "Concurrent title", status: "done", tracker: { provenance: "keep" } })
  expect(next[0].tasks[1]).toBe(groups[0].tasks[1])
  expect(groups[0].tasks[0].status).toBe("todo")
})
