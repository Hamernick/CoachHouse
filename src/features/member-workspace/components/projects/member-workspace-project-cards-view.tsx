"use client"

import { FolderOpen, Plus } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { Empty } from "@/components/ui/empty"
import { MemberWorkspaceProjectCard } from "./member-workspace-project-card"
import {
  type OrganizationCoachAssignmentAction,
  type OrganizationCoachOption,
} from "@/features/organization-coach-assignments"
import type { OrganizationKanbanVisibilityMode } from "@/features/organization-kanban-visibility"
import { MemberWorkspaceOrganizationStaffActions } from "./member-workspace-organization-staff-actions"

export function MemberWorkspaceProjectCardsView({
  onEditProject,
  projects,
  onCreateProject,
  scope,
  visibleProperties,
  coachOptions = [],
  canManageCoachAssignments = false,
  updateCoachAssignmentAction,
  canUnassignCoachAssignments = true,
  kanbanVisibilityMode = "visible",
  pendingVisibilityOrganizationIds = [],
  onOrganizationVisibilityChange,
}: {
  onEditProject?: (project: PlatformAdminDashboardLabProject) => void
  projects: PlatformAdminDashboardLabProject[]
  onCreateProject?: () => void
  scope: "organization" | "platform-admin"
  visibleProperties?: Array<"title" | "status" | "assignee" | "dueDate">
  coachOptions?: OrganizationCoachOption[]
  canManageCoachAssignments?: boolean
  updateCoachAssignmentAction?: OrganizationCoachAssignmentAction
  canUnassignCoachAssignments?: boolean
  kanbanVisibilityMode?: OrganizationKanbanVisibilityMode
  pendingVisibilityOrganizationIds?: string[]
  onOrganizationVisibilityChange?: (
    organizationId: string,
    hidden: boolean
  ) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="p-4">
        <Empty
          icon={<FolderOpen className="h-6 w-6" aria-hidden />}
          title="No organizations yet"
          description={
            scope === "platform-admin"
              ? "Organizations will appear here once accounts are created on the platform."
              : "Organizations will appear here once the active organization has work to track."
          }
          variant="subtle"
          actions={
            onCreateProject ? (
              <Button type="button" variant="outline" onClick={onCreateProject}>
                <Plus data-icon="inline-start" />
                Create new organization
              </Button>
            ) : null
          }
        />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => (
          <MemberWorkspaceProjectCard
            key={project.id}
            project={project}
            onEditProject={
              project.projectKind === "organization_admin"
                ? undefined
                : onEditProject
            }
            visibleProperties={visibleProperties}
            actions={
              project.projectKind === "organization_admin" &&
              project.organizationId ? (
                <MemberWorkspaceOrganizationStaffActions
                  canManageCoachAssignments={canManageCoachAssignments}
                  canUnassignCoachAssignments={canUnassignCoachAssignments}
                  coachOptions={coachOptions}
                  kanbanVisibilityMode={kanbanVisibilityMode}
                  onOrganizationVisibilityChange={
                    onOrganizationVisibilityChange
                  }
                  pendingVisibilityOrganizationIds={
                    pendingVisibilityOrganizationIds
                  }
                  project={project}
                  updateCoachAssignmentAction={updateCoachAssignmentAction}
                />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
