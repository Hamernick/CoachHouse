"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { withSaveFeedback } from "@/lib/with-save-feedback"
import { taskCapabilities } from "../../lib/task-capabilities"
import type {
  MemberWorkspaceTaskGroup, MemberWorkspaceTaskItem, MemberWorkspaceTaskStatus,
  MemberWorkspaceScheduleTaskInput, MemberWorkspaceMoveTaskInput,
} from "../../types"

export type TaskMutationActions = {
  updateTaskStatusAction?: (id: string, status: MemberWorkspaceTaskStatus) => Promise<{ ok: true; taskId: string; status: MemberWorkspaceTaskStatus } | { error: string }>
  scheduleTaskAction?: (input: MemberWorkspaceScheduleTaskInput) => Promise<{ ok: true; taskId: string; startDate: string; endDate: string } | { error: string }>
  moveTaskAction?: (input: MemberWorkspaceMoveTaskInput) => Promise<{ ok: true; projectId: string } | { error: string }>
}

type TaskPatch = Partial<Pick<MemberWorkspaceTaskItem, "status" | "startDate" | "endDate">>

export function patchTaskGroups(groups: MemberWorkspaceTaskGroup[], id: string, patch: TaskPatch) {
  return groups.map(group => ({ ...group, tasks: group.tasks.map(task => task.id === id ? { ...task, ...patch } : task) }))
}

export function useTaskMutations({ initialTaskGroups, canManageTasks, canEditTasks, actions, refresh }: {
  initialTaskGroups: MemberWorkspaceTaskGroup[]
  canManageTasks: boolean
  canEditTasks: boolean
  actions: TaskMutationActions
  refresh: () => void
}) {
  const [baseGroups, setGroups] = useState(initialTaskGroups)
  const [overlays, setOverlays] = useState<Record<string, TaskPatch>>({})
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(new Set())
  const locks = useRef(new Set<string>())
  useEffect(() => setGroups(initialTaskGroups), [initialTaskGroups])
  const groups = useMemo(() => baseGroups.map(group => ({ ...group, tasks: group.tasks.map(task => ({ ...task, ...overlays[task.id] })) })), [baseGroups, overlays])
  const findTask = (id: string) => groups.flatMap(group => group.tasks).find(task => task.id === id)
  const capabilities = (task: MemberWorkspaceTaskItem) => taskCapabilities(task, {
    canManageTasks, canEditTasks,
    hasStatusAction: Boolean(actions.updateTaskStatusAction),
    hasScheduleAction: Boolean(actions.scheduleTaskAction),
    hasOrderAction: Boolean(actions.moveTaskAction),
  })
  const lock = (ids: string[]) => {
    if (ids.some(id => locks.current.has(id))) return false
    ids.forEach(id => locks.current.add(id))
    setPendingTaskIds(new Set(locks.current))
    return true
  }
  const unlock = (ids: string[]) => {
    ids.forEach(id => locks.current.delete(id))
    setPendingTaskIds(new Set(locks.current))
    setOverlays(current => {
      const next = { ...current }
      ids.forEach(id => delete next[id])
      return next
    })
  }
  const toggleTask = async (taskId: string) => {
    const task = findTask(taskId)
    if (!task || !capabilities(task).status || !actions.updateTaskStatusAction || !lock([taskId])) return
    const status = task.status === "done" ? "todo" : "done"
    setOverlays(current => ({ ...current, [taskId]: { status } }))
    try {
      const result = await withSaveFeedback(() => actions.updateTaskStatusAction!(taskId, status), { pending: "Saving task…", success: status === "done" ? "Task completed" : "Task reopened" })
      if (!("error" in result)) setGroups(current => patchTaskGroups(current, taskId, { status: result.status }))
    } finally { unlock([taskId]); refresh() }
  }
  const scheduleTask = async (taskId: string, startDate: string) => {
    const task = findTask(taskId)
    if (!task || !capabilities(task).schedule || !actions.scheduleTaskAction || task.startDate === startDate || !lock([taskId])) return false
    // Keep the card mounted in its current column while saving. Moving it
    // optimistically would unmount the date editor and discard a rejected draft.
    try {
      const result = await withSaveFeedback(() => actions.scheduleTaskAction!({ taskId, projectId: task.projectId, startDate, expectedStartDate: task.startDate, expectedEndDate: task.endDate }), { pending: "Saving schedule…", success: startDate ? "Task scheduled" : "Task moved to Unscheduled" })
      if ("error" in result) return false
      setGroups(current => patchTaskGroups(current, taskId, { startDate: result.startDate, endDate: result.endDate }))
      return true
    } finally { unlock([taskId]); refresh() }
  }
  const moveTask = async (taskId: string, neighborTaskId: string, placement: "before" | "after") => {
    const task = findTask(taskId)
    const neighbor = findTask(neighborTaskId)
    if (!task || !neighbor || task.projectId !== neighbor.projectId || !capabilities(task).order || !capabilities(neighbor).order || !actions.moveTaskAction) return
    const ids = groups.find(group => group.projectId === task.projectId)?.tasks.map(item => item.id) ?? [taskId, neighborTaskId]
    if (!lock(ids)) return
    try {
      await withSaveFeedback(() => actions.moveTaskAction!({ taskId, projectId: task.projectId, neighborTaskId, placement, expectedSortOrder: task.sortOrder!, expectedNeighborSortOrder: neighbor.sortOrder!, expectedUpdatedAt: task.updatedAt!, expectedNeighborUpdatedAt: neighbor.updatedAt! }), { pending: "Saving task order…", success: "Task order saved" })
    } finally { unlock(ids); refresh() }
  }
  return { groups, setGroups, pendingTaskIds, capabilities, toggleTask, scheduleTask, moveTask }
}
