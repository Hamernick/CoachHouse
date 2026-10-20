import { toProjectTask } from "@/features/member-workspace/lib/task-view-model"
import type { MemberWorkspaceTaskItem } from "@/features/member-workspace/types"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { projects } from "@/features/platform-admin-dashboard/upstream/lib/data/projects"
import { personalTaskIds } from "@/features/member-workspace/server/personal-task-scope"
import { describe, expect, it, vi } from "vitest"
import { FilterPopover } from "@/features/platform-admin-dashboard/upstream/components/filter-popover"
import { TaskProjectList } from "@/features/member-workspace/components/tasks/task-project-list"
import { taskCapabilities } from "@/features/member-workspace/lib/task-capabilities"

// Render the actual filter content without requiring a browser portal.
vi.mock("@/features/platform-admin-dashboard/upstream/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => children,
}))

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
  it.each([
    ["To do", ["task-1"]],
    ["In progress", ["task-2"]],
    ["Done", ["task-3"]],
  ])("filters by the displayed %s status label", (value, ids) => {
    expect(filterTasksByChips(TASKS, [{ key: "Status", value }]).map((task) => task.id)).toEqual(ids)
  })

  it("supports No priority and combines multiple statuses with other categories", () => {
    const tasks = TASKS.map((task) => task.id === "task-2" ? { ...task, priority: undefined } : task)
    expect(filterTasksByChips(tasks, [{ key: "Priority", value: "No priority" }]).map((task) => task.id)).toEqual(["task-2"])
    expect(filterTasksByChips(TASKS, [
      { key: "Status", value: "To do" },
      { key: "Status", value: "Done" },
      { key: "Member", value: "No member" },
    ]).map((task) => task.id)).toEqual(["task-3"])
    expect(filterTasksByChips(TASKS, [])).toEqual(TASKS)
  })

  it("renders task statuses and accurate member totals without changing project filters", () => {
    const props = {
      onApply: () => {}, onClear: () => {},
      counts: computeTaskFilterCounts(TASKS),
      memberOptions: [
        { id: "ann", label: "Ann Lee", countKey: "ann lee" },
        { id: "joanne", label: "Joanne Hart", countKey: "joanne hart" },
        { id: "no-member", label: "No member" },
      ],
    }
    const taskMarkup = renderToStaticMarkup(createElement(FilterPopover, { ...props, entityType: "task" }))
    expect(taskMarkup).toContain("To do")
    expect(taskMarkup).toContain("In progress")
    expect(taskMarkup).toContain("Done")
    expect(taskMarkup).not.toContain("Planned")
    expect(taskMarkup).not.toContain("Cancelled")
    expect(taskMarkup).toMatch(/Members<\/span><span[^>]*>3<\/span>/)
    const projectMarkup = renderToStaticMarkup(createElement(FilterPopover, props))
    expect(projectMarkup).toContain("Planned")
    expect(projectMarkup).toContain("Completed")
    expect(projectMarkup).not.toContain("To do")
  })

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


it("retains the shared flat list option for existing consumers", () => {
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

describe("production project task list", () => {
  const task = (id: string, overrides: Partial<MemberWorkspaceTaskItem> = {}): MemberWorkspaceTaskItem => ({
    id, projectId: "project-a", projectName: "Same project name", projectClient: "Organization A",
    projectStatus: "active", projectPriority: "medium", projectTags: [], projectMembers: [],
    projectStartDate: "", projectEndDate: "", title: id, taskType: "task", status: "todo",
    startDate: "", endDate: "", canUpdate: true, ...overrides,
  })
  const group = (tasks: MemberWorkspaceTaskItem[]) => ({
    projectId: tasks[0].projectId, projectName: tasks[0].projectName,
    projectClient: tasks[0].projectClient, projectStatus: tasks[0].projectStatus,
    projectPriority: tasks[0].projectPriority, projectTags: [], projectMembers: [],
    projectStartDate: "", projectEndDate: "", tasks,
  })
  const capabilities = (item: MemberWorkspaceTaskItem) => ({ status: true, details: item.canUpdate, schedule: item.canUpdate, order: item.canUpdate })
  const baseProps = { pendingTaskIds: new Set<string>(), capabilities, onToggleTask: () => {}, onOpenTask: () => {} }

  it("keeps assigned read-only member and fiscal review status rights separate from full editing", () => {
    const statusOnly = task("assigned", { canUpdate: false, capabilities: { status: true, details: false, schedule: false, order: false } })
    for (const canManageTasks of [false, true]) {
      expect(taskCapabilities(statusOnly, { canManageTasks, canEditTasks: true, hasStatusAction: true, hasScheduleAction: true, hasOrderAction: true })).toEqual({ status: true, details: false, schedule: false, order: false })
    }
  })

  it("does not infer permission from a global staff flag when a task explicitly denies it", () => {
    const denied = task("unrelated", { capabilities: { status: false, details: false, schedule: false, order: false }, sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z" })
    expect(taskCapabilities(denied, { canManageTasks: true, canEditTasks: true, hasStatusAction: true, hasScheduleAction: true, hasOrderAction: true })).toEqual({ status: false, details: false, schedule: false, order: false })
  })

  it("requires both permitted actions and stored order versions for editor controls", () => {
    const editor = task("editor", { sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z" })
    const context = { canManageTasks: true, canEditTasks: true, hasStatusAction: true, hasScheduleAction: true, hasOrderAction: true }
    expect(taskCapabilities(editor, context)).toEqual({ status: true, details: true, schedule: true, order: true })
    expect(taskCapabilities(editor, { ...context, canEditTasks: false, hasStatusAction: false, hasScheduleAction: false, hasOrderAction: false })).toEqual({ status: false, details: false, schedule: false, order: false })
    expect(taskCapabilities({ ...editor, updatedAt: undefined }, context).order).toBe(false)
    expect(taskCapabilities({ ...editor, sortOrder: undefined }, context).order).toBe(false)
    expect(taskCapabilities(task("legacy read-only", { canUpdate: false }), context)).toEqual({ status: false, details: false, schedule: false, order: false })
  })

  it("keeps duplicate project names separate by ID with organization context and scoped counts", () => {
    const markup = renderToStaticMarkup(createElement(TaskProjectList, {
      ...baseProps,
      groups: [
        group([task("ordinary"), task("waiting", { status: "waiting" })]),
        group([task("other-project", { projectId: "project-b", projectClient: "Organization B", status: "done" })]),
      ],
    }))
    expect(markup).toContain('href="/projects/project-a"')
    expect(markup).toContain('href="/projects/project-b"')
    expect(markup).toContain("Organization A")
    expect(markup).toContain("Organization B")
    expect(markup).toContain('aria-label="0 of 2 visible tasks completed"')
    expect(markup).toContain('aria-label="1 of 1 visible tasks completed"')
    expect(markup.match(/role="checkbox"/g)).toHaveLength(3)
    expect(markup).toContain("Waiting")
    expect(markup).not.toContain("Reorder task")
  })

  it("keeps shared review completion available without edit, scheduling, order, or unauthorized contextual creation", () => {
    const markup = renderToStaticMarkup(createElement(TaskProjectList, {
      ...baseProps,
      groups: [group([task("Shared fiscal review", { canUpdate: false })])],
      onAddTask: () => {}, canAddTask: () => false, onMoveTask: () => {},
    }))
    expect(markup).toContain('aria-label="Complete Shared fiscal review"')
    expect(markup).not.toMatch(/role="checkbox"[^>]*disabled=""/)
    expect(markup).not.toContain('aria-label="Edit Shared fiscal review"')
    expect(markup).not.toContain('aria-label="Move Shared fiscal review')
    expect(markup).not.toContain('aria-label="Add task')
  })

  it("disables pending or unauthorized checkboxes and pending edit controls", () => {
    const markup = renderToStaticMarkup(createElement(TaskProjectList, {
      ...baseProps,
      pendingTaskIds: new Set(["saving"]),
      capabilities: (item) => ({ ...capabilities(item), status: item.id !== "read-only" }),
      groups: [group([task("saving"), task("read-only")])],
    }))
    expect(markup.match(/role="checkbox"[^>]*disabled=""/g)).toHaveLength(2)
    expect(markup).toMatch(/disabled=""[^>]*aria-label="Edit saving"/)
    expect(markup).toContain('aria-busy="true"')
  })
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
