import { toProjectTask } from "@/features/member-workspace/lib/task-view-model"
import type { MemberWorkspaceTaskItem } from "@/features/member-workspace/types"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { projects } from "@/features/platform-admin-dashboard/upstream/lib/data/projects"
import { personalTaskIds } from "@/features/member-workspace/server/personal-task-scope"
import { describe, expect, it } from "vitest"

import {
  ProjectTaskListView,
  computeTaskFilterCounts,
  filterTasksByChips,
} from "@/features/platform-admin-dashboard/upstream/components/tasks/task-helpers"
import type { ProjectTask } from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"

const TASKS: ProjectTask[] = [
  {
    id: "task-1",
    name: "Review intake",
    status: "todo",
    assignee: { id: "user-ann", name: "Ann Lee", avatarUrl: "/ann.png" },
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    dueLabel: "02/04/2026",
    priority: "high",
    tag: "Feature",
    projectId: "project-1",
    projectName: "Alpha",
    workstreamId: "alpha-general",
    workstreamName: "General",
  },
  {
    id: "task-2",
    name: "Finalize docs",
    status: "in-progress",
    assignee: { id: "user-joanne", name: "Joanne Hart", avatarUrl: "/joanne.png" },
    startDate: new Date("2026-04-02T00:00:00.000Z"),
    dueLabel: "03/04/2026",
    priority: "medium",
    tag: "Bug",
    projectId: "project-1",
    projectName: "Alpha",
    workstreamId: "alpha-general",
    workstreamName: "General",
  },
  {
    id: "task-3",
    name: "Ship update",
    status: "done",
    startDate: new Date("2026-04-03T00:00:00.000Z"),
    dueLabel: "04/04/2026",
    priority: "high",
    tag: "Feature",
    projectId: "project-2",
    projectName: "Beta",
    workstreamId: "beta-general",
    workstreamName: "General",
  },
]

describe("member workspace task filters", () => {
  it("matches members exactly instead of substring matching", () => {
    const result = filterTasksByChips(TASKS, [
      { key: "Member", value: "Ann Lee" },
    ])

    expect(result.map((task) => task.id)).toEqual(["task-1"])
  })

  it("applies status, priority, tag, and member filters together", () => {
    const result = filterTasksByChips(TASKS, [
      { key: "Status", value: "Todo" },
      { key: "Priority", value: "High" },
      { key: "Tag", value: "feature" },
      { key: "Member", value: "Ann Lee" },
    ])

    expect(result.map((task) => task.id)).toEqual(["task-1"])
  })

  it("computes faceted counts from the real filtered task set", () => {
    const counts = computeTaskFilterCounts(TASKS, [
      { key: "Tag", value: "feature" },
    ])

    expect(counts.status).toEqual({
      todo: 1,
      done: 1,
    })
    expect(counts.members).toEqual({
      "ann lee": 1,
      current: 1,
      "no-member": 1,
    })
  })
})

// Personal list membership must not include tasks delegated to somebody else.
describe("personal task membership", () => {
  it("includes assigned and self-created unassigned tasks, excluding delegated and unrelated tasks", () => {
    const tasks = [
      { id: "assigned", org_id: "org", created_by: "other" },
      { id: "personal", org_id: "org", created_by: "me" },
      { id: "delegated", org_id: "org", created_by: "me" },
      { id: "unrelated", org_id: "org", created_by: "other" },
      { id: "shared", org_id: "org", created_by: "other" },
    ]
    const assignments = [
      { task_id: "assigned", user_id: "me" },
      { task_id: "delegated", user_id: "other" },
      { task_id: "shared", user_id: "other" },
      { task_id: "shared", user_id: "me" },
    ]
    expect([...personalTaskIds(tasks, assignments, "me")]).toEqual(["assigned", "personal", "shared"])
    expect([...personalTaskIds(tasks, assignments, "nobody")]).toEqual([])
  })
})


it("renders one task list with organization context and no project sections or reorder handles", () => {
  const markup = renderToStaticMarkup(createElement(ProjectTaskListView, {
    flat: true,
    groups: [
      { project: projects[0], tasks: [{ ...TASKS[0], organizationName: "Legal Wellness" }] },
      { project: projects[1], tasks: [{ ...TASKS[2], organizationName: "Community Pantry" }] },
    ],
    onToggleTask: () => {},
    onAddTask: () => {},
  }))
  expect(markup.match(/role="list"/g)).toHaveLength(1)
  expect(markup.match(/role="listitem"/g)).toHaveLength(2)
  expect(markup).toContain("Legal Wellness")
  expect(markup).toContain("Community Pantry")
  expect(markup).not.toContain("Reorder task")
})


describe("task calendar dates", () => {
  it("keeps stored calendar days in western and eastern timezones", () => {
    const original = process.env.TZ
    try {
      for (const zone of ["America/New_York", "Pacific/Honolulu", "Asia/Tokyo"]) {
        process.env.TZ = zone
        const task: MemberWorkspaceTaskItem = {
          id: "date-check", projectId: "project", projectName: "Project",
          projectClient: null, projectStatus: "active", projectPriority: "medium",
          projectTags: [], projectMembers: [], projectStartDate: "2026-09-20",
          projectEndDate: "2026-09-21", title: "Calendar day", taskType: "task",
          status: "todo", startDate: "2026-09-20", endDate: "2026-09-21", canUpdate: true,
        }
        const row = toProjectTask(task)
        expect(row.dueLabel).toBe("21/09/2026")
        expect(row.startDate?.getDate()).toBe(20)
        expect(row.startDate?.getHours()).toBe(0)
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })
})
