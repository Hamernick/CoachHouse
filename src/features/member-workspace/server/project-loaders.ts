// Recording fixtures only; staff demo and unfinished real organizations remain visible.
const DIRECTORY_FIXTURE_ORGANIZATION_IDS = new Set([
  "886455ec-a664-4f13-83f1-471ddd1f5ffd", // Southside Community Table recording fixture
])

import {
  loadAdminOrganizationSummaries,
  mapAdminOrganizationSummaryToProject,
} from "./admin-organization-overview"
import {
  attachCanonicalProjectIdsToOrganizations,
  ensureCanonicalAdminProjects,
} from "./admin-projects"
import { loadAccessibleOrganizations } from "./load-accessible-organizations"
import {
  mapOrganizationProjectToViewModel,
  type OrganizationProjectRecord,
} from "./project-starter-data"
import { loadMemberWorkspacePersonOptionsForOrganizations } from "./person-options"
import {
  actorCanAccessOrganizations,
  filterOrganizationsForActor,
} from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { organizationProjectSelectFields } from "./project-select"
import { resolveMemberWorkspaceStorageMode } from "./starter-data"
import {
  isMissingOrganizationProjectsTableError,
  toMemberWorkspaceDataError,
} from "./table-errors"
import { loadPlatformAdminWorkstreamConfiguration } from "./admin-workstreams"
import { attachFiscalProjectReviewerLabels } from "./fiscal-project-reviewer-labels"

async function loadAdminStandardOrganizationProjects({
  orgIds,
  supabase,
}: {
  orgIds: string[]
  supabase: Awaited<
    ReturnType<typeof resolveMemberWorkspaceActorContext>
  >["supabase"]
}) {
  if (orgIds.length === 0) {
    return [] as OrganizationProjectRecord[]
  }

  const { data, error } = await supabase
    .from("organization_projects")
    .select(organizationProjectSelectFields)
    .in("org_id", orgIds)
    .eq("project_kind", "standard")
    .neq("created_source", "system")
    .neq("created_source", "starter_seed")
    .order("created_at", { ascending: false })
    .returns<OrganizationProjectRecord[]>()

  if (error) {
    if (isMissingOrganizationProjectsTableError(error)) {
      return null
    }
    throw toMemberWorkspaceDataError(
      error,
      "Unable to load organization projects."
    )
  }

  return data ?? []
}

export async function loadMemberWorkspaceProjectsPage({
  directory = "organizations", actorScope = "workspace",
}: { directory?: "organizations" | "projects"; actorScope?: "workspace" | "platform" } = {}) {
  const actor = await resolveMemberWorkspaceActorContext(actorScope)

  if (actorCanAccessOrganizations(actor)) {
    const organizations = filterOrganizationsForActor(
      actor,
      (await loadAdminOrganizationSummaries({
        supabase: actor.supabase,
      })).filter((organization) => !DIRECTORY_FIXTURE_ORGANIZATION_IDS.has(organization.orgId))
    )
    const orgIds = organizations.map((organization) => organization.orgId)
    const organizationOptions = organizations.map((organization) => ({
      orgId: organization.orgId,
      name: organization.name,
    }))
    const [assigneeOptions, canonicalProjects, standardProjects, guestResult] =
      await Promise.all([
        loadMemberWorkspacePersonOptionsForOrganizations({
          orgIds: [],
          supabase: actor.supabase,
          includePlatformAdmins: true,
        }),
        directory === "projects" ? Promise.resolve([] as OrganizationProjectRecord[]) : ensureCanonicalAdminProjects({
          organizations,
          supabase: actor.supabase,
        }),
        directory === "organizations" ? Promise.resolve([] as OrganizationProjectRecord[]) : loadAdminStandardOrganizationProjects({
          orgIds,
          supabase: actor.supabase,
        }),
        directory === "projects"
          ? actor.supabase.rpc("list_fiscal_guest_projects", { p_user_id: actor.userId })
          : Promise.resolve({ data: [], error: null }),
      ])

    if (guestResult.error) throw toMemberWorkspaceDataError(guestResult.error, "Unable to load assigned fiscal projects.")
    const guestProjects = await attachFiscalProjectReviewerLabels({
      projects: (guestResult.data ?? []) as unknown as OrganizationProjectRecord[],
      people: assigneeOptions,
      supabase: actor.supabase,
    })

    if (!canonicalProjects || !standardProjects) {
      return {
        projects: directory === "projects" ? [] : organizations.map(mapAdminOrganizationSummaryToProject),
        storageMode: "custom" as const,
        starterProjectCount: 0,
        hasUserProjects: organizations.length > 0,
        canResetStarterData: false,
        canCreateProjects: false,
        scope: "platform-admin" as const,
        organizationOptions,
        assigneeOptions,
        workstreamCategories: [],
      }
    }

    const organizationsWithProjectIds =
      attachCanonicalProjectIdsToOrganizations({
        canonicalProjects,
        organizations,
      })
    const organizationByProjectId = new Map(
      organizationsWithProjectIds.map((organization) => [
        organization.canonicalProjectId,
        organization,
      ])
    )

    const organizationNames = new Map(organizationOptions.map((org) => [org.orgId, org.name]))
    const projects = [
      ...canonicalProjects.map((project) => {
        const viewModel = mapOrganizationProjectToViewModel(project)
        const organization = organizationByProjectId.get(project.id)
        if (!organization) return viewModel
        const organizationView = mapAdminOrganizationSummaryToProject(organization)

        return {
          ...viewModel,
          organizationImageUrl: organizationView.organizationImageUrl,
          client: organizationView.client,
          durationLabel: organizationView.durationLabel,
          progress: organization.setupProgress,
          primaryPersonName: organization.ownerName,
          primaryPersonAvatarUrl: organization.ownerAvatarUrl,
          taskSummaryLabel: "Tasks",
        }
      }),
      ...standardProjects.map(mapOrganizationProjectToViewModel).map((project) => ({ ...project, client: project.organizationUnassigned ? undefined : organizationNames.get(project.organizationId ?? "") ?? undefined })),
      ...guestProjects.map(mapOrganizationProjectToViewModel),
    ]
    const workstreamConfiguration =
      await loadPlatformAdminWorkstreamConfiguration({
        actor,
        projectIds: projects.map((project) => project.id),
      })
    const workstreamCategories = workstreamConfiguration?.categories ?? []
    const fallbackCategory = workstreamCategories[0] ?? null
    const projectsWithWorkstreams = projects.map((project) => {
      const storedCategoryId =
        workstreamConfiguration?.categoryIdByProjectId.get(project.id)
      const statusCategory = workstreamCategories.find(
        (category) => category.defaultKey === project.status
      ) ?? (project.status === "active" ? workstreamCategories.find(
        (category) => category.defaultKey === "planned"
      ) : undefined)

      return {
        ...project,
        workstreamCategoryId:
          storedCategoryId ?? statusCategory?.id ?? fallbackCategory?.id,
      }
    })

    return {
      projects: projectsWithWorkstreams,
      storageMode: "custom" as const,
      starterProjectCount: 0,
      hasUserProjects:
        organizationsWithProjectIds.length > 0 || standardProjects.length > 0 || guestProjects.length > 0,
      canResetStarterData: false,
      canCreateProjects: true,
      scope: "platform-admin" as const,
      organizationOptions,
      assigneeOptions,
      workstreamCategories,
    }
  }

  const accessibleOrganizations = await loadAccessibleOrganizations(
    actor.supabase,
    actor.userId
  )
  const activeOrganizationOption =
    accessibleOrganizations.find(
      (organization) => organization.orgId === actor.activeOrg.orgId
    ) ?? null
  const organizationOptions = activeOrganizationOption
    ? [
        {
          orgId: activeOrganizationOption.orgId,
          name: activeOrganizationOption.name,
        },
      ]
    : [{ orgId: actor.activeOrg.orgId, name: "Active organization" }]
  const assigneeOptions = await loadMemberWorkspacePersonOptionsForOrganizations({
    orgIds: [actor.activeOrg.orgId],
    supabase: actor.supabase,
  })

  const { data: projects, error } = await actor.supabase
    .from("organization_projects")
    .select(organizationProjectSelectFields)
    .eq("org_id", actor.activeOrg.orgId)
    .eq("project_kind", "standard")
    .neq("created_source", "system")
    .order("created_at", { ascending: false })
    .returns<OrganizationProjectRecord[]>()

  if (error) {
    if (isMissingOrganizationProjectsTableError(error)) {
      return {
        projects: [],
        storageMode: "empty" as const,
        starterProjectCount: 0,
        hasUserProjects: false,
        canResetStarterData: false,
        canCreateProjects: actor.canEdit,
        scope: "organization" as const,
        organizationOptions,
        assigneeOptions,
        workstreamCategories: [],
      }
    }
    throw toMemberWorkspaceDataError(
      error,
      "Unable to load workspace projects."
    )
  }

  const rows = projects ?? []
  const storageMode = resolveMemberWorkspaceStorageMode(rows)
  const starterProjectCount = rows.filter(
    (project) => project.created_source === "starter_seed"
  ).length

  return {
    projects: rows.map(mapOrganizationProjectToViewModel),
    storageMode,
    starterProjectCount,
    hasUserProjects: rows.some(
      (project) => project.created_source !== "starter_seed"
    ),
    canResetStarterData: actor.canEdit && starterProjectCount > 0,
    canCreateProjects: actor.canEdit,
    scope: "organization" as const,
    organizationOptions,
    assigneeOptions,
    workstreamCategories: [],
  }
}
