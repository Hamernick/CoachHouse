import { defaultOrganizationCoachFilter, loadOrganizationCoachAssignmentData } from "@/features/organization-coach-assignments"
import {
  clearMemberWorkspaceStarterDataAction,
  createPlatformAdminWorkstreamCategoryAction,
  createMemberWorkspaceProjectAction,
  deletePlatformAdminWorkstreamCategoryAction,
  loadMemberWorkspaceProjectsPage,
  MemberWorkspaceProjectsPage,
  restorePlatformAdminWorkstreamDefaultsAction,
  updatePlatformAdminProjectWorkstreamAction,
  updatePlatformAdminWorkstreamCategoryAction,
  updateMemberWorkspaceProjectAction,
  updateMemberWorkspaceProjectScheduleAction,
  updateMemberWorkspaceProjectStatusAction,
} from "@/features/member-workspace"
import { requirePlatformCapability } from "@/lib/admin/auth"

export default async function OrganizationsPage() {
  const staff = await requirePlatformCapability("organizations", {
    loginRedirect: "/organizations",
  })

  const {
    projects,
    storageMode,
    canResetStarterData,
    starterProjectCount,
    canCreateProjects,
    scope,
    organizationOptions,
    assigneeOptions,
    workstreamCategories,
  } = await loadMemberWorkspaceProjectsPage()

  const assignments = await loadOrganizationCoachAssignmentData({
    organizationIds: organizationOptions.map((organization) => organization.orgId),
  })
  const { data: profile } = await staff.supabase.from("profiles")
    .select("full_name, email, avatar_url").eq("id", staff.userId).maybeSingle()
  const currentCoach = assignments.coachOptions.find((coach) => coach.id === staff.userId) ?? {
    id: staff.userId, name: profile?.full_name ?? "You",
    email: profile?.email ?? null, avatarUrl: profile?.avatar_url ?? null,
  }
  const defaultCoachFilter = defaultOrganizationCoachFilter(currentCoach)
  const coachOptions = assignments.coachOptions.some((coach) => coach.id === staff.userId)
    ? assignments.coachOptions : [...assignments.coachOptions, currentCoach]
  const assignedProjects = projects.map((project) => ({
    ...project,
    organizationCoachAssignments: project.organizationId
      ? assignments.assignmentsByOrganizationId.get(project.organizationId) ?? []
      : [],
  }))

  return (
    <MemberWorkspaceProjectsPage
      projects={assignedProjects}
      showPlatformRevenue
      defaultCoachFilter={defaultCoachFilter}
      coachOptions={coachOptions}
      storageMode={storageMode}
      canResetStarterData={canResetStarterData}
      starterProjectCount={starterProjectCount}
      clearStarterDataAction={clearMemberWorkspaceStarterDataAction}
      createProjectAction={
        canCreateProjects ? createMemberWorkspaceProjectAction : undefined
      }
      updateProjectAction={
        canCreateProjects ? updateMemberWorkspaceProjectAction : undefined
      }
      updateProjectScheduleAction={
        canCreateProjects
          ? updateMemberWorkspaceProjectScheduleAction
          : undefined
      }
      updateProjectStatusAction={
        canCreateProjects ? updateMemberWorkspaceProjectStatusAction : undefined
      }
      canCreateProjects={canCreateProjects}
      scope={scope}
      organizationOptions={organizationOptions}
      assigneeOptions={assigneeOptions}
      workstreamCategories={workstreamCategories}
      createWorkstreamCategoryAction={
        createPlatformAdminWorkstreamCategoryAction
      }
      updateWorkstreamCategoryAction={
        updatePlatformAdminWorkstreamCategoryAction
      }
      deleteWorkstreamCategoryAction={
        deletePlatformAdminWorkstreamCategoryAction
      }
      restoreWorkstreamDefaultsAction={
        restorePlatformAdminWorkstreamDefaultsAction
      }
      updateProjectWorkstreamAction={updatePlatformAdminProjectWorkstreamAction}
    />
  )
}
