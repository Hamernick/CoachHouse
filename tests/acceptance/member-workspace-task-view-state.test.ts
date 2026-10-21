import { describe, expect, it } from "vitest"
import { readTaskViewState, writeTaskViewState } from "@/features/member-workspace/lib/task-view-state"
import { patchTaskGroups } from "@/features/member-workspace/components/tasks/use-task-mutations"
import type { MemberWorkspaceTaskGroup } from "@/features/member-workspace/types"

describe("task URL state", () => {
  it("round trips view, relation, filters and weekend while preserving unrelated query state", () => {
    const params = new URLSearchParams("source=project")
    const state = { view: "board" as const, relation: ["owned", "collaborating"] as ("owned" | "collaborating")[], completion: "completed" as const, ordering: "added" as const, week: "2026-10-19", weekend: true, filters: [{ key: "Status", value: "Waiting" }, { key: "Tag", value: "Program & outreach" }] }
    const next = writeTaskViewState(params, state)
    expect(next.get("source")).toBe("project")
    expect(readTaskViewState(next)).toEqual(state)
    expect(params.toString()).toBe("source=project")
  })
  it("falls back from invalid URLs without introducing fixture member assumptions", () => {
    const params = new URLSearchParams({ taskView: "timeline", taskRelation: "everyone", taskWeek: "2026-02-30", taskFilters: JSON.stringify([{ key: "Member", value: "Current member" }, { key: "admin", value: "all" }, { key: "Tag", value: "Safe" }]) })
    expect(readTaskViewState(params, new Date(2026, 9, 20))).toEqual({ view: "list", relation: ["owned"], completion: "all", ordering: "manual", week: "2026-10-19", weekend: false, filters: [{ key: "Tag", value: "Safe" }] })
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


it("accepts legacy single relationships, removes duplicates and preserves an empty selection", () => {
  expect(readTaskViewState(new URLSearchParams("taskRelation=proposed")).relation).toEqual(["proposed"])
  expect(readTaskViewState(new URLSearchParams("taskRelation=owned,owned,collaborating,bogus")).relation).toEqual(["owned", "collaborating"])
  const state = { ...readTaskViewState(new URLSearchParams()), relation: [] }
  expect(readTaskViewState(writeTaskViewState(new URLSearchParams(), state)).relation).toEqual([])
})

import { selectPersonalTaskGroups } from "@/features/member-workspace/lib/task-presentation"
import type { MemberWorkspaceTaskItem } from "@/features/member-workspace/types"

const sample = (id: string, fields: Partial<MemberWorkspaceTaskItem> = {}) => ({
  id, assignee: { id: "me" }, status: "todo", endDate: "", ...fields,
}) as MemberWorkspaceTaskItem
const taskGroups = (tasks: MemberWorkspaceTaskItem[]) => [{ projectId: "one", tasks }] as MemberWorkspaceTaskGroup[]
const initial = readTaskViewState(new URLSearchParams())

it("unions personal relationships once per task and never includes another person's task", () => {
  const tracker = { sourceId: "import", collaboratorUserIds: ["me"], collaboratorNames: [] }
  const groups = taskGroups([
    sample("owned"), sample("overlap", { tracker }),
    sample("proposed", { assignee: null, tracker: { ...tracker, collaboratorUserIds: [], assignmentStatus: "Proposed", proposedUserId: "me" } }),
    sample("collaborating", { assignee: { id: "other", name: "Other", avatarUrl: null }, tracker }),
    sample("unrelated", { assignee: { id: "other", name: "Other", avatarUrl: null } }),
  ])
  const result = selectPersonalTaskGroups(groups, "me", { ...initial, relation: ["owned", "proposed", "collaborating"] })
  expect(result[0].tasks.map(task => task.id)).toEqual(["owned", "overlap", "proposed", "collaborating"])
  expect(selectPersonalTaskGroups(groups, "me", { ...initial, relation: [] })).toEqual([])
})

it("sorts real added dates newest first and deadlines earliest first, with unknowns last", () => {
  const groups = taskGroups([
    sample("unknown"),
    sample("old", { createdAt: "2026-10-01T12:00:00Z", endDate: "2026-10-30" }),
    sample("new", { createdAt: "2026-10-20T12:00:00Z", endDate: "2026-10-21" }),
    sample("same", { createdAt: "2026-10-20T12:00:00Z", endDate: "2026-10-21" }),
    sample("invalid", { createdAt: "invalid", endDate: "invalid" }),
  ])
  for (const ordering of ["added", "due"] as const) {
    expect(selectPersonalTaskGroups(groups, "me", { ...initial, ordering })[0].tasks.map(task => task.id)).toEqual(["new", "same", "old", "unknown", "invalid"])
  }
  expect(groups[0].tasks[0].id).toBe("unknown")
  expect(selectPersonalTaskGroups(groups, "me", initial)[0].tasks).toEqual(groups[0].tasks)
})

it("updates completion visibility after a task is checked without changing its project or metadata", () => {
  const groups = taskGroups([sample("a"), sample("b", { status: "done" })])
  const incomplete = { ...initial, completion: "incomplete" as const }
  expect(selectPersonalTaskGroups(groups, "me", incomplete)[0].tasks.map(task => task.id)).toEqual(["a"])
  expect(selectPersonalTaskGroups(patchTaskGroups(groups, "a", { status: "done" }), "me", incomplete)).toEqual([])
  expect(selectPersonalTaskGroups(groups, "me", { ...initial, completion: "completed" })[0].tasks.map(task => task.id)).toEqual(["b"])
})
