"use client"

import { Button } from "@/components/ui/button"

import { PlatformRevenueStat } from "./platform-revenue-stat"
import { OrganizationSearchField } from "./organization-search-field"

import {
  ChipOverflow,
  type PlatformAdminDashboardLabProject,
} from "@/features/platform-admin-dashboard"
import {
  OrganizationCoachAssignmentOperationsBar,
  type AssignAllOrganizationCoachesAction,
  type OrganizationCoachAssignmentCoverage,
  type OrganizationCoachFilterValue,
  type OrganizationCoachOption,
  type OrganizationCoachScopeStatus,
  type SetOrganizationCoachScopeAction,
} from "@/features/organization-coach-assignments"
import {
  OrganizationKanbanVisibilityFilter,
  type OrganizationKanbanVisibilityMode,
} from "@/features/organization-kanban-visibility"
import type { MemberWorkspaceProjectFilterCounts } from "./member-workspace-project-filters"
import { MemberWorkspaceProjectFilterPopover } from "./member-workspace-project-filter-popover"
import { MemberWorkspaceProjectViewOptionsPopover } from "./member-workspace-project-view-options-popover"
import type {
  MemberWorkspaceProjectFilterChip,
  MemberWorkspaceProjectViewOptions,
} from "./member-workspace-project-view-options"
import { MemberWorkspaceClearStarterDataButton } from "../shared/member-workspace-clear-starter-data-button"

export function MemberWorkspaceProjectsHeader({
  directory = "organizations",
  onCreateProject,
  showPlatformRevenue = false,
  assignAllCoachesAction,
  canManageCoachAssignments,
  canResetStarterData,
  clearStarterDataAction,
  coachAssignmentCoverage,
  coachFilter,
  coachOptions,
  coachScopeStatus,
  counts,
  filters,
  kanbanVisibility,
  onCoachFilterChange,
  onFiltersChange,
  onKanbanVisibilityChange,
  onViewOptionsChange,
  projects,
  setCoachScopeAction,
  showAssignedOrganizationsEmpty,
  viewOptions,
}: {
  directory?: "organizations" | "projects"
  onCreateProject?: () => void
  showPlatformRevenue?: boolean
  assignAllCoachesAction?: AssignAllOrganizationCoachesAction
  canManageCoachAssignments: boolean
  canResetStarterData: boolean
  clearStarterDataAction?: () => Promise<{ ok: true } | { error: string }>
  coachAssignmentCoverage: OrganizationCoachAssignmentCoverage
  coachFilter: OrganizationCoachFilterValue
  coachOptions: OrganizationCoachOption[]
  coachScopeStatus: OrganizationCoachScopeStatus
  counts: MemberWorkspaceProjectFilterCounts
  filters: MemberWorkspaceProjectFilterChip[]
  kanbanVisibility: {
    available: boolean
    hiddenCount: number
    mode: OrganizationKanbanVisibilityMode
    visibleCount: number
  }
  onCoachFilterChange: (value: OrganizationCoachFilterValue) => void
  onFiltersChange: (filters: MemberWorkspaceProjectFilterChip[]) => void
  onKanbanVisibilityChange: (mode: OrganizationKanbanVisibilityMode) => void
  onViewOptionsChange: (options: MemberWorkspaceProjectViewOptions) => void
  projects: PlatformAdminDashboardLabProject[]
  setCoachScopeAction?: SetOrganizationCoachScopeAction
  showAssignedOrganizationsEmpty: boolean
  viewOptions: MemberWorkspaceProjectViewOptions
}) {
  return (
    <header className="border-border/40 flex flex-col border-b">
      <div className="border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-3 sm:px-4">
        <p className="text-foreground text-base font-medium">{directory === "projects" ? "Projects" : "Organizations"}</p>
        {onCreateProject ? <Button size="sm" className="min-h-11 sm:min-h-0" onClick={onCreateProject}>New project</Button> : null}
        {showPlatformRevenue ? (
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:w-auto">
            <PlatformRevenueStat kind="coaching" />
            <PlatformRevenueStat />
          </div>
        ) : null}
        {canResetStarterData && clearStarterDataAction ? (
          <MemberWorkspaceClearStarterDataButton
            clearStarterDataAction={clearStarterDataAction}
          />
        ) : null}
      </div>

      {canManageCoachAssignments &&
      assignAllCoachesAction &&
      setCoachScopeAction ? (
        <div className="border-border border-b px-4 py-3">
          <OrganizationCoachAssignmentOperationsBar
            assignAllAction={assignAllCoachesAction}
            coachOptions={coachOptions}
            coverage={coachAssignmentCoverage}
            value={coachFilter}
            onValueChange={onCoachFilterChange}
            scopeStatus={coachScopeStatus}
            setScopeAction={setCoachScopeAction}
          />
        </div>
      ) : null}

      {!showAssignedOrganizationsEmpty ? (
        <div className="flex flex-col items-stretch gap-3 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <OrganizationSearchField
              entity={directory}
              value={
                filters.find((chip) => chip.key.toLowerCase() === "search")
                  ?.value ?? ""
              }
              onSearch={(value) =>
                onFiltersChange([
                  ...filters.filter(
                    (chip) => chip.key.toLowerCase() !== "search"
                  ),
                  ...(value.trim()
                    ? [{ key: "Search", value: value.trim() }]
                    : []),
                ])
              }
            />
            <MemberWorkspaceProjectFilterPopover
              coachOptions={coachOptions}
              coachFilter={coachFilter}
              onCoachFilterChange={onCoachFilterChange}
              projects={projects}
              initialChips={filters}
              onApply={onFiltersChange}
              onClear={() =>
                onFiltersChange(
                  filters.filter((chip) => chip.key.toLowerCase() === "search")
                )
              }
              counts={counts}
            />
            <ChipOverflow
              chips={filters.filter(
                (chip) => chip.key.toLowerCase() !== "search"
              )}
              onRemove={(key, value) =>
                onFiltersChange(
                  filters.filter(
                    (chip) => !(chip.key === key && chip.value === value)
                  )
                )
              }
              maxVisible={6}
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end">
            {kanbanVisibility.available ? (
              <OrganizationKanbanVisibilityFilter
                hiddenCount={kanbanVisibility.hiddenCount}
                onValueChange={onKanbanVisibilityChange}
                value={kanbanVisibility.mode}
                visibleCount={kanbanVisibility.visibleCount}
              />
            ) : null}
            {kanbanVisibility.mode === "visible" ? (
              <MemberWorkspaceProjectViewOptionsPopover
                options={viewOptions}
                onChange={onViewOptionsChange}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  )
}
