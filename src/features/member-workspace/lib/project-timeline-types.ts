import type { MemberWorkspaceTaskStatus } from "../types"

export type TimelineTask = {
  id: string
  projectId: string
  name: string
  status: MemberWorkspaceTaskStatus
  startDate: string
  endDate: string
  canEdit: boolean
}
export type TimelineDateChange = {
  projectId: string
  taskId?: string
  startDate: string
  endDate: string
  expectedStartDate: string
  expectedEndDate: string
}
export type TimelineResult<T> = T | { error: string }
export type ProjectTimelineActions = {
  load: (
    projectId: string
  ) => Promise<TimelineResult<{ tasks: TimelineTask[]; canEdit: boolean }>>
  dates: (
    input: TimelineDateChange
  ) => Promise<TimelineResult<{ ok: true; startDate: string; endDate: string }>>
  status: (input: {
    projectId: string
    taskId: string
    status: MemberWorkspaceTaskStatus
    expectedStatus: MemberWorkspaceTaskStatus
  }) => Promise<TimelineResult<{ ok: true; status: MemberWorkspaceTaskStatus }>>
}
