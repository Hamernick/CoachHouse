"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceCreateProjectFormInput,
  MemberWorkspacePersonOption,
  MemberWorkspaceProjectOrganizationOption,
  MemberWorkspaceStorageMode,
  MemberWorkspaceWorkstreamCategory,
} from "../../types"
import { MemberWorkspaceProjectBoardView } from "./member-workspace-project-board-view"
import { MemberWorkspaceProjectCardsView } from "./member-workspace-project-cards-view"
import {
  computeMemberWorkspaceProjectFilterCounts,
  filterMemberWorkspaceProjects,
} from "./member-workspace-project-filters"
import { MemberWorkspaceProjectTimelineView } from "./member-workspace-project-timeline-view"
import { MemberWorkspaceProjectWizard } from "./member-workspace-project-wizard"
import { MemberWorkspaceProjectsEmptyStates } from "./member-workspace-projects-empty-states"
import { MemberWorkspaceProjectsHeader } from "./member-workspace-projects-header"
import styles from "./member-workspace-projects-surface-theme.module.css"
import {
  applyOrganizationCoachFilterToParams,
  computeOrganizationCoachAssignmentCoverage,
  filterProjectsByOrganizationCoach,
  normalizeOrganizationCoachFilter,
  ORGANIZATION_COACH_FILTER_ALL,
  type OrganizationCoachFilterValue,
  type AssignAllOrganizationCoachesAction,
  type OrganizationCoachAssignmentAction,
  type OrganizationCoachOption,
  type OrganizationCoachScopeStatus,
  type SetOrganizationCoachScopeAction,
} from "@/features/organization-coach-assignments"
import {
  applyOrganizationKanbanVisibilityToParams,
  computeOrganizationKanbanVisibilityCounts,
  filterProjectsByOrganizationKanbanVisibility,
  normalizeOrganizationKanbanVisibilityMode,
  ORGANIZATION_KANBAN_VISIBILITY_HIDDEN,
  ORGANIZATION_KANBAN_VISIBILITY_VISIBLE,
  useOrganizationKanbanVisibilityController,
  type OrganizationKanbanVisibilityMode,
  type UpdateOrganizationKanbanVisibilityAction,
} from "@/features/organization-kanban-visibility"
import {
  applyViewOptionsToParams,
  DEFAULT_MEMBER_WORKSPACE_PROJECT_VIEW_OPTIONS as DEFAULT_VIEW_OPTIONS,
  chipsToParams,
  paramsToViewOptions,
  paramsToChips,
  type MemberWorkspaceProjectFilterChip as FilterChip,
} from "./member-workspace-project-view-options"

type MemberWorkspaceProjectsPageProps = {
  directory?: "organizations" | "projects"
  projects: PlatformAdminDashboardLabProject[]
  storageMode: MemberWorkspaceStorageMode
  canResetStarterData: boolean
  starterProjectCount: number
  clearStarterDataAction?: () => Promise<{ ok: true } | { error: string }>
  createProjectAction?: (
    input: MemberWorkspaceCreateProjectFormInput
  ) => Promise<{ ok: true; id: string } | { error: string }>
  updateProjectAction?: (
    projectId: string,
    input: MemberWorkspaceCreateProjectFormInput
  ) => Promise<{ ok: true; id: string } | { error: string }>
  updateProjectScheduleAction?: (
    projectId: string,
    startDate: string,
    endDate: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  updateProjectStatusAction?: (
    projectId: string,
    status: PlatformAdminDashboardLabProject["status"]
  ) => Promise<{ ok: true; id: string } | { error: string }>
  canCreateProjects: boolean
  organizationOptions: MemberWorkspaceProjectOrganizationOption[]
  assigneeOptions: MemberWorkspacePersonOption[]
  showPlatformRevenue?: boolean
  defaultCoachFilter?: OrganizationCoachFilterValue
  coachOptions?: OrganizationCoachOption[]
  canManageCoachAssignments?: boolean
  updateCoachAssignmentAction?: OrganizationCoachAssignmentAction
  assignAllCoachesAction?: AssignAllOrganizationCoachesAction
  coachScopeStatus?: OrganizationCoachScopeStatus
  setCoachScopeAction?: SetOrganizationCoachScopeAction
  showAssignedOrganizationsEmpty?: boolean
  kanbanVisibilityAvailable?: boolean
  hiddenOrganizationIds?: string[]
  updateOrganizationKanbanVisibilityAction?: UpdateOrganizationKanbanVisibilityAction
  scope: "organization" | "platform-admin"
  workstreamCategories?: MemberWorkspaceWorkstreamCategory[]
  createWorkstreamCategoryAction?: (
    name: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  updateWorkstreamCategoryAction?: (
    categoryId: string,
    name: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  deleteWorkstreamCategoryAction?: (
    categoryId: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
  restoreWorkstreamDefaultsAction?: () => Promise<
    { ok: true } | { error: string }
  >
  updateProjectWorkstreamAction?: (
    projectId: string,
    categoryId: string
  ) => Promise<{ ok: true; id: string } | { error: string }>
}

function getView(
  visibility: OrganizationKanbanVisibilityMode,
  viewType: "list" | "board" | "timeline"
) {
  return visibility === ORGANIZATION_KANBAN_VISIBILITY_HIDDEN
    ? "list"
    : viewType
}

export function MemberWorkspaceProjectsPage(
  props: MemberWorkspaceProjectsPageProps
) {
  const {
    directory = "organizations",
    projects,
    canResetStarterData,
    clearStarterDataAction,
    createProjectAction,
    updateProjectAction,
    updateProjectScheduleAction,
    updateProjectStatusAction,
    canCreateProjects,
    organizationOptions,
    assigneeOptions,
    scope,
    coachOptions = [],
    defaultCoachFilter = ORGANIZATION_COACH_FILTER_ALL,
    showPlatformRevenue = false,
    canManageCoachAssignments = false,
    updateCoachAssignmentAction,
    assignAllCoachesAction,
    coachScopeStatus = {
      available: false,
      assignedOnlyEnabled: false,
      activatedAt: null,
    },
    setCoachScopeAction,
    showAssignedOrganizationsEmpty = false,
    kanbanVisibilityAvailable = false,
    hiddenOrganizationIds = [],
    updateOrganizationKanbanVisibilityAction,
    workstreamCategories = [],
    createWorkstreamCategoryAction,
    updateWorkstreamCategoryAction,
    deleteWorkstreamCategoryAction,
    restoreWorkstreamDefaultsAction,
    updateProjectWorkstreamAction,
  } = props
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterChip[]>([])
  const [coachFilter, setCoachFilter] = useState<OrganizationCoachFilterValue>(
    defaultCoachFilter
  )
  const [viewOptions, setViewOptions] = useState({ ...DEFAULT_VIEW_OPTIONS, ...(directory === "projects" ? { viewType: "board" as const } : {}) })
  const [kanbanVisibilityMode, setKanbanVisibilityMode] =
    useState<OrganizationKanbanVisibilityMode>(
      ORGANIZATION_KANBAN_VISIBILITY_VISIBLE
    )
  const [isProjectWizardOpen, setIsProjectWizardOpen] = useState(false)
  const [editingProject, setEditingProject] =
    useState<PlatformAdminDashboardLabProject | null>(null)

  const prevParamsRef = useRef("")
  const kanbanVisibility = useOrganizationKanbanVisibilityController({
    initialHiddenOrganizationIds: hiddenOrganizationIds,
    updateVisibilityAction: updateOrganizationKanbanVisibilityAction,
  })

  useEffect(() => {
    const currentParams = searchParams.toString()
    const currentStateKey = `${currentParams}|${coachOptions
      .map((coach) => coach.id)
      .join(",")}`
    if (prevParamsRef.current === currentStateKey) return

    prevParamsRef.current = currentStateKey
    const params = new URLSearchParams(currentParams)
    setFilters(paramsToChips(params))
    setCoachFilter(
      normalizeOrganizationCoachFilter({
        coachOptions,
        value: params.get("coach") ?? defaultCoachFilter,
      })
    )
    if (directory === "projects" && !params.has("view")) params.set("view", "board")
    setViewOptions(paramsToViewOptions(params))
    setKanbanVisibilityMode(
      normalizeOrganizationKanbanVisibilityMode(params.get("visibility"))
    )
  }, [coachOptions, defaultCoachFilter, directory, searchParams])

  const replaceSearchState = ({
    nextFilters = filters,
    nextCoachFilter = coachFilter,
    nextKanbanVisibilityMode = kanbanVisibilityMode,
    nextViewOptions = viewOptions,
  }: {
    nextFilters?: FilterChip[]
    nextCoachFilter?: OrganizationCoachFilterValue
    nextKanbanVisibilityMode?: OrganizationKanbanVisibilityMode
    nextViewOptions?: typeof viewOptions
  }) => {
    const params = chipsToParams(nextFilters)
    applyOrganizationCoachFilterToParams(params, nextCoachFilter)
    if (defaultCoachFilter !== "all" && nextCoachFilter === "all") params.set("coach", "all")
    applyOrganizationKanbanVisibilityToParams(params, nextKanbanVisibilityMode)
    applyViewOptionsToParams(params, nextViewOptions)
    if (directory === "projects") params.set("view", nextViewOptions.viewType)
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    })
  }

  const handleFiltersChange = (nextFilters: FilterChip[]) => {
    setFilters(nextFilters)
    replaceSearchState({ nextFilters })
  }

  const handleViewOptionsChange = (nextViewOptions: typeof viewOptions) => {
    setViewOptions(nextViewOptions)
    replaceSearchState({ nextViewOptions })
  }

  const handleCoachFilterChange = (
    nextCoachFilter: OrganizationCoachFilterValue
  ) => {
    setCoachFilter(nextCoachFilter)
    replaceSearchState({ nextCoachFilter })
  }

  const handleKanbanVisibilityModeChange = (
    nextKanbanVisibilityMode: OrganizationKanbanVisibilityMode
  ) => {
    setKanbanVisibilityMode(nextKanbanVisibilityMode)
    replaceSearchState({ nextKanbanVisibilityMode })
  }

  const handleClearAllFilters = () => {
    setFilters([])
    setCoachFilter(ORGANIZATION_COACH_FILTER_ALL)
    setKanbanVisibilityMode(ORGANIZATION_KANBAN_VISIBILITY_VISIBLE)
    replaceSearchState({
      nextFilters: [],
      nextCoachFilter: ORGANIZATION_COACH_FILTER_ALL,
      nextKanbanVisibilityMode: ORGANIZATION_KANBAN_VISIBILITY_VISIBLE,
    })
  }

  const coachAssignmentCoverage = useMemo(
    () => computeOrganizationCoachAssignmentCoverage(projects),
    [projects]
  )
  const coachFilteredProjects = useMemo(
    () =>
      filterProjectsByOrganizationCoach({
        projects,
        value: coachFilter,
      }),
    [coachFilter, projects]
  )
  const kanbanVisibilityCounts = useMemo(
    () =>
      computeOrganizationKanbanVisibilityCounts({
        hiddenOrganizationIds: kanbanVisibility.hiddenOrganizationIdSet,
        projects,
      }),
    [kanbanVisibility.hiddenOrganizationIdSet, projects]
  )
  const kanbanVisibleProjects = useMemo(
    () =>
      filterProjectsByOrganizationKanbanVisibility({
        hiddenOrganizationIds: kanbanVisibility.hiddenOrganizationIdSet,
        mode: kanbanVisibilityMode,
        projects: coachFilteredProjects,
      }),
    [
      coachFilteredProjects,
      kanbanVisibility.hiddenOrganizationIdSet,
      kanbanVisibilityMode,
    ]
  )

  const filteredProjects = useMemo(
    () =>
      filterMemberWorkspaceProjects({
        filters,
        projects: kanbanVisibleProjects,
        viewOptions,
      }),
    [filters, kanbanVisibleProjects, viewOptions]
  )

  const counts = useMemo(
    () =>
      computeMemberWorkspaceProjectFilterCounts({
        filters,
        projects: kanbanVisibleProjects,
        viewOptions,
      }),
    [filters, kanbanVisibleProjects, viewOptions]
  )
  const hasActiveFilters =
    filters.length > 0 ||
    coachFilter !== ORGANIZATION_COACH_FILTER_ALL ||
    kanbanVisibilityMode === ORGANIZATION_KANBAN_VISIBILITY_HIDDEN
  const showHiddenOrganizationsEmpty =
    kanbanVisibilityMode === ORGANIZATION_KANBAN_VISIBILITY_HIDDEN &&
    kanbanVisibleProjects.length === 0
  const showAllOrganizationsHidden =
    kanbanVisibilityMode === ORGANIZATION_KANBAN_VISIBILITY_VISIBLE &&
    kanbanVisibilityCounts.visible === 0 &&
    kanbanVisibilityCounts.hidden > 0 &&
    kanbanVisibleProjects.length === 0
  const showFilteredEmpty = hasActiveFilters && filteredProjects.length === 0
  const showPageEmpty =
    showAssignedOrganizationsEmpty ||
    showHiddenOrganizationsEmpty ||
    showAllOrganizationsHidden ||
    showFilteredEmpty
  const effectiveViewType = getView(kanbanVisibilityMode, viewOptions.viewType)

  return (
    <>
      <div
        className={`${styles.surface} bg-background -mx-[var(--shell-content-pad)] -mt-[var(--shell-content-pad)] -mb-[var(--shell-content-pad)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
      >
        <MemberWorkspaceProjectsHeader
          directory={directory}
          onCreateProject={directory === "projects" && canCreateProjects ? () => { setEditingProject(null); setIsProjectWizardOpen(true) } : undefined}
          assignAllCoachesAction={assignAllCoachesAction}
          canManageCoachAssignments={canManageCoachAssignments}
          canResetStarterData={canResetStarterData}
          clearStarterDataAction={clearStarterDataAction}
          coachAssignmentCoverage={coachAssignmentCoverage}
          showPlatformRevenue={showPlatformRevenue}
          coachFilter={coachFilter}
          coachOptions={coachOptions}
          coachScopeStatus={coachScopeStatus}
          counts={counts}
          filters={filters}
          kanbanVisibility={{
            available: kanbanVisibilityAvailable,
            hiddenCount: kanbanVisibilityCounts.hidden,
            mode: kanbanVisibilityMode,
            visibleCount: kanbanVisibilityCounts.visible,
          }}
          onCoachFilterChange={handleCoachFilterChange}
          onFiltersChange={handleFiltersChange}
          onKanbanVisibilityChange={handleKanbanVisibilityModeChange}
          onViewOptionsChange={handleViewOptionsChange}
          projects={kanbanVisibleProjects}
          setCoachScopeAction={setCoachScopeAction}
          showAssignedOrganizationsEmpty={showAssignedOrganizationsEmpty}
          viewOptions={viewOptions}
        />

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <MemberWorkspaceProjectsEmptyStates
            directory={directory}
            onClearFilters={handleClearAllFilters}
            onVisibilityModeChange={handleKanbanVisibilityModeChange}
            showAssignedOrganizationsEmpty={showAssignedOrganizationsEmpty}
            showAllOrganizationsHidden={showAllOrganizationsHidden}
            showFilteredEmpty={showFilteredEmpty}
            showHiddenOrganizationsEmpty={showHiddenOrganizationsEmpty}
          />
          {!showPageEmpty && effectiveViewType === "timeline" ? (
            <MemberWorkspaceProjectTimelineView
              projects={filteredProjects}
              updateProjectScheduleAction={updateProjectScheduleAction}
            />
          ) : null}
          {!showPageEmpty && effectiveViewType === "list" ? (
            <MemberWorkspaceProjectCardsView
              projects={filteredProjects}
              visibleProperties={viewOptions.properties}
              onCreateProject={
                canCreateProjects
                  ? () => {
                      setEditingProject(null)
                      setIsProjectWizardOpen(true)
                    }
                  : undefined
              }
              onEditProject={
                canCreateProjects
                  ? (project) => {
                      setEditingProject(project)
                      setIsProjectWizardOpen(true)
                    }
                  : undefined
              }
              scope={scope}
              coachOptions={coachOptions}
              canManageCoachAssignments={canManageCoachAssignments}
              updateCoachAssignmentAction={updateCoachAssignmentAction}
              canUnassignCoachAssignments={
                !coachScopeStatus.assignedOnlyEnabled
              }
              kanbanVisibilityMode={kanbanVisibilityMode}
              pendingVisibilityOrganizationIds={
                kanbanVisibility.pendingOrganizationIds
              }
              onOrganizationVisibilityChange={
                kanbanVisibilityAvailable
                  ? kanbanVisibility.setOrganizationHidden
                  : undefined
              }
            />
          ) : null}
          {!showPageEmpty && effectiveViewType === "board" ? (
            <MemberWorkspaceProjectBoardView
              projects={filteredProjects}
              showClosedProjects={viewOptions.showClosedProjects}
              visibleProperties={viewOptions.properties}
              updateProjectStatusAction={updateProjectStatusAction}
              workstreamCategories={workstreamCategories}
              createWorkstreamCategoryAction={createWorkstreamCategoryAction}
              updateWorkstreamCategoryAction={updateWorkstreamCategoryAction}
              deleteWorkstreamCategoryAction={deleteWorkstreamCategoryAction}
              restoreWorkstreamDefaultsAction={restoreWorkstreamDefaultsAction}
              updateProjectWorkstreamAction={updateProjectWorkstreamAction}
              coachOptions={coachOptions}
              canManageCoachAssignments={canManageCoachAssignments}
              updateCoachAssignmentAction={updateCoachAssignmentAction}
              canUnassignCoachAssignments={
                !coachScopeStatus.assignedOnlyEnabled
              }
              kanbanVisibilityMode={kanbanVisibilityMode}
              pendingVisibilityOrganizationIds={
                kanbanVisibility.pendingOrganizationIds
              }
              onOrganizationVisibilityChange={
                kanbanVisibilityAvailable
                  ? kanbanVisibility.setOrganizationHidden
                  : undefined
              }
              onAddProject={
                canCreateProjects
                  ? () => {
                      setEditingProject(null)
                      setIsProjectWizardOpen(true)
                    }
                  : undefined
              }
              onEditProject={
                canCreateProjects
                  ? (project) => {
                      setEditingProject(project)
                      setIsProjectWizardOpen(true)
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>

      <ProjectWizardOverlay
        open={isProjectWizardOpen}
        onOpenChange={(open) => { setIsProjectWizardOpen(open); if (!open) setEditingProject(null) }}
        initialProject={editingProject}
        organizationOptions={organizationOptions}
        assigneeOptions={assigneeOptions}
        createProjectAction={createProjectAction}
        updateProjectAction={updateProjectAction}
      />
    </>
  )
}


function ProjectWizardOverlay(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProject: PlatformAdminDashboardLabProject | null
  organizationOptions: MemberWorkspaceProjectsPageProps["organizationOptions"]
  assigneeOptions: MemberWorkspaceProjectsPageProps["assigneeOptions"]
  createProjectAction: MemberWorkspaceProjectsPageProps["createProjectAction"]
  updateProjectAction: MemberWorkspaceProjectsPageProps["updateProjectAction"]
}) {
  if (!props.createProjectAction) return null
  return <MemberWorkspaceProjectWizard {...props} createProjectAction={props.createProjectAction} />
}
