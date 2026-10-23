import { matchesPersonalTaskRelation } from "@/lib/task-tracker"
import type { MemberWorkspaceTaskGroup } from "../types"
import type { TaskViewState } from "./task-view-state"
import { comparePresentationDates } from "./presentation-date-order"

export function selectPersonalTaskGroups(groups: MemberWorkspaceTaskGroup[], viewerUserId: string, state: Pick<TaskViewState, "relation" | "completion" | "ordering">) {
  return groups.map(group => {
    const tasks = group.tasks.filter(task => {
      if (!state.relation.some(relation => matchesPersonalTaskRelation(task, viewerUserId, relation))) return false
      if (state.completion === "completed") return task.status === "done"
      if (state.completion === "incomplete") return task.status !== "done"
      return true
    })
    if (state.ordering === "due") tasks.sort((a, b) => comparePresentationDates(a.endDate, b.endDate))
    if (state.ordering === "added") tasks.sort((a, b) => comparePresentationDates(a.createdAt, b.createdAt, true))
    return { ...group, tasks }
  }).filter(group => group.tasks.length)
}
