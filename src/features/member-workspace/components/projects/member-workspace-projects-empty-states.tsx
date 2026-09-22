"use client"

import { Empty } from "@/components/ui/empty"
import {
  ORGANIZATION_KANBAN_VISIBILITY_HIDDEN,
  ORGANIZATION_KANBAN_VISIBILITY_VISIBLE,
  OrganizationKanbanAllHiddenEmpty,
  OrganizationKanbanVisibilityEmpty,
  type OrganizationKanbanVisibilityMode,
} from "@/features/organization-kanban-visibility"
import { MemberWorkspaceProjectsFilteredEmpty } from "./member-workspace-projects-filtered-empty"

export function MemberWorkspaceProjectsEmptyStates({
  directory = "organizations",
  onClearFilters,
  onVisibilityModeChange,
  showAssignedOrganizationsEmpty,
  showAllOrganizationsHidden,
  showFilteredEmpty,
  showHiddenOrganizationsEmpty,
}: {
  directory?: "organizations" | "projects"
  onClearFilters: () => void
  onVisibilityModeChange: (mode: OrganizationKanbanVisibilityMode) => void
  showAssignedOrganizationsEmpty: boolean
  showAllOrganizationsHidden: boolean
  showFilteredEmpty: boolean
  showHiddenOrganizationsEmpty: boolean
}) {
  if (showAssignedOrganizationsEmpty) {
    return (
      <div className="h-full p-6">
        <Empty
          title="No assigned organizations"
          description="Ask a developer to assign an organization to your coach account."
          variant="subtle"
        />
      </div>
    )
  }
  if (showHiddenOrganizationsEmpty) {
    return (
      <OrganizationKanbanVisibilityEmpty
        onShowKanban={() =>
          onVisibilityModeChange(ORGANIZATION_KANBAN_VISIBILITY_VISIBLE)
        }
      />
    )
  }
  if (showAllOrganizationsHidden) {
    return (
      <OrganizationKanbanAllHiddenEmpty
        onReviewHidden={() =>
          onVisibilityModeChange(ORGANIZATION_KANBAN_VISIBILITY_HIDDEN)
        }
      />
    )
  }
  if (showFilteredEmpty) {
    return <MemberWorkspaceProjectsFilteredEmpty directory={directory} onClear={onClearFilters} />
  }
  return null
}
