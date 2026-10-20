import type { MemberWorkspaceTaskItem } from "../types"

type TaskCapabilityContext = {
  canManageTasks: boolean
  canEditTasks: boolean
  hasStatusAction: boolean
  hasScheduleAction: boolean
  hasOrderAction: boolean
}

// Server-loaded per-task rights are authoritative for presentation. Every action
// still authenticates and authorizes independently; these flags are not authz.
export function taskCapabilities(task: MemberWorkspaceTaskItem, context: TaskCapabilityContext) {
  return {
    status: context.hasStatusAction && (task.capabilities?.status ?? (context.canManageTasks && task.canUpdate)),
    details: context.canManageTasks && context.canEditTasks && (task.capabilities?.details ?? task.canUpdate),
    schedule: context.canManageTasks && context.hasScheduleAction && (task.capabilities?.schedule ?? task.canUpdate),
    order: context.canManageTasks && context.hasOrderAction && (task.capabilities?.order ?? task.canUpdate) && task.sortOrder !== undefined && Boolean(task.updatedAt),
  }
}
