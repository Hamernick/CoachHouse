import type { Metadata } from "next"
import {
  clearMemberWorkspaceStarterDataAction,
  createDirectoryTaskAction,
  loadMemberWorkspaceTasksPage,
  MemberWorkspaceTasksPage,
  scheduleMemberWorkspaceTaskAction,
  moveMemberWorkspaceTaskAction,
  updateDirectoryTaskAction,
  updateDirectoryTaskStatusAction,
} from "@/features/member-workspace"
import { hasPlatformCapability } from "@/features/platform-access"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { requireMemberWorkspacePageAccess } from "@/lib/workspace/member-workspace-access"

export const metadata: Metadata = {
  title: "Tasks",
  description: "Plan, assign, and track work across your projects.",
}


export default async function TasksPage() {
  await requireMemberWorkspacePageAccess("tasks")
  const { user, profileAudience } = await resolveAuthenticatedAppContext()

  const {
    taskGroups,
    storageMode,
    starterTaskCount,
    hasAnyOrgTasks,
    canResetStarterData,
    canManageTasks,
    scope,
    assigneeOptions,
    projectOptions,
  } = await loadMemberWorkspaceTasksPage(hasPlatformCapability(profileAudience.platformAccessLevel, "organizations") ? "platform" : "workspace")

  return (
    <MemberWorkspaceTasksPage
      viewerUserId={user.id}
      initialTaskGroups={taskGroups}
      storageMode={storageMode}
      starterTaskCount={starterTaskCount}
      hasAnyOrgTasks={hasAnyOrgTasks}
      canResetStarterData={canResetStarterData}
      canManageTasks={canManageTasks}
      clearStarterDataAction={clearMemberWorkspaceStarterDataAction}
      updateTaskStatusAction={
        updateDirectoryTaskStatusAction
      }
      createTaskAction={canManageTasks ? createDirectoryTaskAction : undefined}
      updateTaskAction={canManageTasks ? updateDirectoryTaskAction : undefined}
      scheduleTaskAction={canManageTasks ? scheduleMemberWorkspaceTaskAction : undefined}
      moveTaskAction={canManageTasks ? moveMemberWorkspaceTaskAction : undefined}
      scope={scope}
      assigneeOptions={assigneeOptions}
      projectOptions={projectOptions}
    />
  )
}
