import { loadOrganizationCoachAssignmentData } from "@/features/organization-coach-assignments"
import {
  createMemberWorkspaceProjectAction,
  loadMemberWorkspaceProjectsPage,
  MemberWorkspaceProjectsPage,
  updateMemberWorkspaceProjectAction,
  updateMemberWorkspaceProjectScheduleAction,
  updateMemberWorkspaceProjectStatusAction,
  updatePlatformAdminProjectWorkstreamAction,
} from "@/features/member-workspace"
import { requirePlatformCapability } from "@/lib/admin/auth"

export default async function ProjectsPage() {
  await requirePlatformCapability("organizations", { loginRedirect: "/projects" })
  const data = await loadMemberWorkspaceProjectsPage({ directory: "projects" })
  const assignments = await loadOrganizationCoachAssignmentData({
    organizationIds: data.organizationOptions.map((organization) => organization.orgId),
  })
  const projects = data.projects.map((project) => ({
    ...project,
    organizationCoachAssignments: project.organizationId
      ? assignments.assignmentsByOrganizationId.get(project.organizationId) ?? [] : [],
  }))
  return <MemberWorkspaceProjectsPage
    {...data}
    directory="projects"
    projects={projects}
    coachOptions={assignments.coachOptions}
    defaultCoachFilter="all"
    createProjectAction={data.canCreateProjects ? createMemberWorkspaceProjectAction : undefined}
    updateProjectAction={data.canCreateProjects ? updateMemberWorkspaceProjectAction : undefined}
    updateProjectScheduleAction={data.canCreateProjects ? updateMemberWorkspaceProjectScheduleAction : undefined}
    updateProjectStatusAction={data.canCreateProjects ? updateMemberWorkspaceProjectStatusAction : undefined}
    updateProjectWorkstreamAction={data.canCreateProjects ? updatePlatformAdminProjectWorkstreamAction : undefined}
  />
}
