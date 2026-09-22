import { format, parseISO } from "date-fns"
import type {
  Project,
  ProjectTask,
  ProjectTaskGroup,
} from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceTaskItem,
  MemberWorkspaceTaskGroup,
} from "../types"

export function toProjectTask(task: MemberWorkspaceTaskItem): ProjectTask {
  return {
    id: task.id,
    name: task.title,
    status: task.status,
    dueLabel: format(parseISO(task.endDate), "dd/MM/yyyy"),
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name,
          avatarUrl: task.assignee.avatarUrl ?? undefined,
        }
      : undefined,
    startDate: parseISO(task.startDate),
    priority: task.priority,
    tag: task.tagLabel ?? undefined,
    description: task.description,
    projectId: task.projectId,
    projectName: task.projectName,
    organizationName:
      task.organizationName ?? task.projectClient ?? "Organization",
    workstreamId: task.workstreamName
      ? `${task.projectId}:${task.workstreamName.toLowerCase().replace(/\s+/g, "-")}`
      : `${task.projectId}:general`,
    workstreamName: task.workstreamName ?? "General",
  }
}

export function toProjectGroup(
  group: MemberWorkspaceTaskGroup
): ProjectTaskGroup {
  const tasks = group.tasks.map(toProjectTask)
  const done = tasks.filter((task) => task.status === "done").length
  const total = tasks.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const project: Project = {
    id: group.projectId,
    name: group.projectName,
    taskCount: total,
    progress,
    startDate: parseISO(group.projectStartDate),
    endDate: parseISO(group.projectEndDate),
    status: group.projectStatus,
    priority: group.projectPriority,
    tags: group.projectTags,
    members: group.projectMembers,
    client: group.projectClient ?? undefined,
    typeLabel: group.projectTypeLabel ?? undefined,
    durationLabel: group.projectDurationLabel ?? undefined,
    tasks: tasks.map((task) => ({
      id: task.id,
      name: task.name,
      type: group.tasks.find((item) => item.id === task.id)?.taskType ?? "task",
      assignee: task.assignee?.name ?? "",
      status: task.status,
      startDate: task.startDate ?? new Date(),
      endDate: parseISO(
        group.tasks.find((item) => item.id === task.id)?.endDate ??
          group.projectEndDate
      ),
    })),
  }

  return {
    project,
    tasks,
  }
}
