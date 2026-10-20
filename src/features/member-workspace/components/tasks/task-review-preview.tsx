"use client"

import { useEffect, useRef, useState } from "react"
import { MemberWorkspaceTasksPage } from "./member-workspace-tasks-page"
import type { MemberWorkspaceTaskGroup, MemberWorkspaceTaskItem } from "../../types"
import { upsertPersonalTask } from "../../lib/saved-task"

const people = [{ id: "preview-viewer", name: "You", avatarUrl: null }]
const projects = [{ id: "preview-project-a", label: "Community program" }, { id: "preview-project-b", label: "Community program" }]
const sampleTask = (id: string, title: string, overrides: Partial<MemberWorkspaceTaskItem> = {}): MemberWorkspaceTaskItem => ({
  id, title, projectId: projects[0].id, projectName: projects[0].label, projectClient: "Northside Collective",
  organizationName: "Northside Collective", projectStatus: "active", projectPriority: "medium",
  projectTags: [], projectMembers: [], projectStartDate: "", projectEndDate: "", taskType: "task",
  status: "todo", startDate: "", endDate: "", canUpdate: true, assignee: people[0],
  sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z", workstreamName: "General", ...overrides,
})
const seed = [
  sampleTask("preview-task-1", "Confirm the community venue", { startDate: "2026-10-20", endDate: "2026-10-23", priority: "high", tagLabel: "Planning" }),
  sampleTask("preview-task-2", "Review the program budget", { status: "waiting", startDate: "2026-10-21", endDate: "2026-10-23", sortOrder: 1 }),
  sampleTask("preview-task-3", "Prepare volunteer welcome notes", { endDate: "2026-10-22", sortOrder: 2 }),
  sampleTask("preview-task-4", "Confirm weekend volunteers", { startDate: "2026-10-24", sortOrder: 3 }),
  sampleTask("preview-task-5", "Review last week’s outreach", { startDate: "2026-10-16", endDate: "2026-10-19", sortOrder: 4 }),
  sampleTask("preview-task-6", "Review fiscal application", { projectId: projects[1].id, projectClient: "Eastside Partners", organizationName: "Eastside Partners", canUpdate: false, capabilities: { status: true, details: false, schedule: false, order: false } }),
]
function groupTasks(tasks: MemberWorkspaceTaskItem[]): MemberWorkspaceTaskGroup[] {
  return projects.map(project => {
    const matching = tasks.filter(task => task.projectId === project.id)
    const item = matching[0] ?? seed[0]
    return { projectId: project.id, projectName: project.label, projectClient: item.projectClient,
      projectStatus: item.projectStatus, projectPriority: item.projectPriority, projectTags: [], projectMembers: [],
      projectStartDate: "", projectEndDate: "", tasks: matching }
  }).filter(group => group.tasks.length)
}

// This gated visual fixture uses sample records only. No server actions or database clients.
export function TaskReviewPreview() {
  const [groups, setGroups] = useState(() => groupTasks(seed))
  const savedGroups = useRef(groups)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tasks-review-fixture")
      if (saved) { savedGroups.current = JSON.parse(saved); setGroups(savedGroups.current) }
    } catch { /* A stale sample draft can be discarded. */ }
    setReady(true)
  }, [])
  const saveGroups = (update: (current: MemberWorkspaceTaskGroup[]) => MemberWorkspaceTaskGroup[]) => {
    const next = update(savedGroups.current)
    sessionStorage.setItem("tasks-review-fixture", JSON.stringify(next))
    savedGroups.current = next
    setGroups(next)
  }
  const patch = (id: string, fields: Partial<MemberWorkspaceTaskItem>) => saveGroups(current => current.map(group => ({ ...group, tasks: group.tasks.map(task => task.id === id ? { ...task, ...fields } : task) })))
  if (!ready) return <p className="p-4">Loading sample tasks…</p>
  return <main className="flex min-h-svh flex-col bg-background text-foreground">
    <p className="border-b px-4 py-2 text-xs text-muted-foreground">Tasks preview · sample data only</p>
    <MemberWorkspaceTasksPage viewerUserId={people[0].id} initialTaskGroups={groups} storageMode="custom"
      starterTaskCount={0} hasAnyOrgTasks canResetStarterData={false} canManageTasks
      projectOptions={[projects[0]]} assigneeOptions={people} scope="platform-admin"
      updateTaskStatusAction={async (taskId, status) => { patch(taskId, { status }); return { ok: true, taskId, status } }}
      createTaskAction={async input => {
        const taskId = `preview-${Date.now()}`
        saveGroups(current => upsertPersonalTask(current, taskId, input, projects[0].label, people, people[0].id))
        return { ok: true, taskId }
      }}
      updateTaskAction={async (taskId, input) => {
        saveGroups(current => upsertPersonalTask(current, taskId, input, projects[0].label, people, people[0].id))
        return { ok: true, taskId }
      }}
      scheduleTaskAction={async input => {
        if (new URLSearchParams(window.location.search).get("rejectSchedule") === "1") return { error: "Sample conflict: this task changed. Refresh and try again." }
        const task = groups.flatMap(group => group.tasks).find(item => item.id === input.taskId)!
        if (input.startDate && task.endDate && input.startDate > task.endDate) return { error: "Start date cannot be after the deadline. Open the task to edit both dates." }
        patch(input.taskId, { startDate: input.startDate })
        return { ok: true, taskId: input.taskId, startDate: input.startDate, endDate: task.endDate }
      }}
      moveTaskAction={async input => {
        saveGroups(current => current.map(group => {
          if (group.projectId !== input.projectId) return group
          const task = group.tasks.find(item => item.id === input.taskId)!
          const remaining = group.tasks.filter(item => item.id !== input.taskId)
          const index = remaining.findIndex(item => item.id === input.neighborTaskId)
          remaining.splice(index + Number(input.placement === "after"), 0, task)
          return { ...group, tasks: remaining.map((item, sortOrder) => ({ ...item, sortOrder })) }
        }))
        return { ok: true, projectId: input.projectId }
      }} />
  </main>
}
