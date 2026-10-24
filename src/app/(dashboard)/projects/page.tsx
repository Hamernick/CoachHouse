import type { Metadata } from "next"
import { loadProjectTimelineAction, saveProjectTimelineDatesAction, saveProjectTimelineStatusAction } from "@/features/member-workspace"
import {
  createMemberWorkspaceProjectAction,
  deleteMemberWorkspaceProjectAction,
  loadMemberWorkspaceProjectsPage,
  MemberWorkspaceProjectsPage,
  updateMemberWorkspaceProjectAction,
  updateMemberWorkspaceProjectScheduleAction,
  updateMemberWorkspaceProjectStatusAction,
  updatePlatformAdminProjectWorkstreamAction,
} from "@/features/member-workspace"
import { requirePlatformCapability } from "@/lib/admin/auth"

export const metadata: Metadata = {
  title: "Projects",
  description: "Organize projects, track progress, and coordinate your team.",
}


export default async function ProjectsPage() {
  await requirePlatformCapability("organizations", { loginRedirect: "/projects" })
  const data = await loadMemberWorkspaceProjectsPage({ directory: "projects", actorScope: "platform" })
  return <MemberWorkspaceProjectsPage
      timelineActions={{ load: loadProjectTimelineAction, dates: saveProjectTimelineDatesAction, status: saveProjectTimelineStatusAction }}
    {...data}
    directory="projects"
    deleteProjectAction={data.canCreateProjects ? deleteMemberWorkspaceProjectAction : undefined}
    defaultCoachFilter="all"
    createProjectAction={data.canCreateProjects ? createMemberWorkspaceProjectAction : undefined}
    updateProjectAction={data.canCreateProjects ? updateMemberWorkspaceProjectAction : undefined}
    updateProjectScheduleAction={data.canCreateProjects ? updateMemberWorkspaceProjectScheduleAction : undefined}
    updateProjectStatusAction={data.canCreateProjects ? updateMemberWorkspaceProjectStatusAction : undefined}
    updateProjectWorkstreamAction={data.canCreateProjects ? updatePlatformAdminProjectWorkstreamAction : undefined}
  />
}
