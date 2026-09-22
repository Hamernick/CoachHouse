"use client"

import { ScrollFadeEffect } from "@/components/scroll-fade-effect"

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from "react"
import { useRouter } from "next/navigation"
import {
  DotsThreeVertical,
  Plus,
  StackSimple,
  Spinner,
  CircleNotch,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import {
  type OrganizationCoachAssignmentAction,
  type OrganizationCoachOption,
} from "@/features/organization-coach-assignments"
import type { OrganizationKanbanVisibilityMode } from "@/features/organization-kanban-visibility"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MemberWorkspaceProjectCard } from "./member-workspace-project-card"
import type { MemberWorkspaceWorkstreamCategory } from "../../types"
import {
  MemberWorkspaceProjectBoardCategoryMenu,
  MemberWorkspaceProjectBoardCategoryToolbar,
} from "./member-workspace-project-board-category-controls"
import { MemberWorkspaceOrganizationStaffActions } from "./member-workspace-organization-staff-actions"

const OPEN_COLUMN_ORDER: Array<PlatformAdminDashboardLabProject["status"]> = [
  "backlog",
  "planned",
  "active",
]

const CLOSED_COLUMN_ORDER: Array<PlatformAdminDashboardLabProject["status"]> = [
  "completed",
  "cancelled",
]

export function getMemberWorkspaceProjectBoardColumnOrder(
  showClosedProjects: boolean
) {
  return showClosedProjects
    ? [...OPEN_COLUMN_ORDER, ...CLOSED_COLUMN_ORDER]
    : OPEN_COLUMN_ORDER
}

function getColumnStatusIcon(
  status: PlatformAdminDashboardLabProject["status"]
) {
  switch (status) {
    case "backlog":
      return <StackSimple className="text-muted-foreground h-4 w-4" />
    case "planned":
      return <Spinner className="text-muted-foreground h-4 w-4" />
    case "active":
      return <CircleNotch className="text-muted-foreground h-4 w-4" />
    case "completed":
      return <CheckCircle className="text-muted-foreground h-4 w-4" />
    default:
      return <StackSimple className="text-muted-foreground h-4 w-4" />
  }
}

function getColumnStatusLabel(
  status: PlatformAdminDashboardLabProject["status"]
) {
  switch (status) {
    case "backlog":
      return "Backlog"
    case "planned":
      return "Planned"
    case "active":
      return "Active"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function useMemberWorkspaceProjectBoardColumns({
  hiddenWorkstreamCategoryKeys,
  showClosedProjects,
  usesCustomWorkstreams,
  workstreamCategories,
}: {
  hiddenWorkstreamCategoryKeys: string[]
  showClosedProjects: boolean
  usesCustomWorkstreams: boolean
  workstreamCategories: MemberWorkspaceWorkstreamCategory[]
}) {
  const allColumns = useMemo(() => {
    if (usesCustomWorkstreams) {
      return workstreamCategories.map((category) => ({
        id: category.id,
        label: category.name,
        color: category.color,
        defaultKey: category.defaultKey,
      }))
    }

    return getMemberWorkspaceProjectBoardColumnOrder(showClosedProjects).map(
      (status) => ({
        id: status,
        label: getColumnStatusLabel(status),
        color: "slate",
        defaultKey: status,
      })
    )
  }, [showClosedProjects, usesCustomWorkstreams, workstreamCategories])
  const hiddenCategoryKeySet = useMemo(
    () => new Set(hiddenWorkstreamCategoryKeys),
    [hiddenWorkstreamCategoryKeys]
  )
  const columns = useMemo(
    () =>
      usesCustomWorkstreams
        ? allColumns.filter(
            (column) =>
              !column.defaultKey || !hiddenCategoryKeySet.has(column.defaultKey)
          )
        : allColumns,
    [allColumns, hiddenCategoryKeySet, usesCustomWorkstreams]
  )
  const hiddenCategories = useMemo(
    () =>
      usesCustomWorkstreams
        ? allColumns.flatMap((column) =>
            column.defaultKey && hiddenCategoryKeySet.has(column.defaultKey)
              ? [{ key: column.defaultKey, name: column.label }]
              : []
          )
        : [],
    [allColumns, hiddenCategoryKeySet, usesCustomWorkstreams]
  )

  return { allColumns, columns, hiddenCategories }
}

type MemberWorkspaceProjectBoardViewProps = {
  projects: PlatformAdminDashboardLabProject[]
  onAddProject?: () => void
  onEditProject?: (project: PlatformAdminDashboardLabProject) => void
  updateProjectStatusAction?: (
    projectId: string,
    status: PlatformAdminDashboardLabProject["status"]
  ) => Promise<{ ok: true; id: string } | { error: string }>
  showClosedProjects: boolean
  hiddenWorkstreamCategoryKeys?: string[]
  onHiddenWorkstreamCategoryKeysChange?: (categoryKeys: string[]) => void
  visibleProperties?: Array<"title" | "status" | "assignee" | "dueDate">
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
}

export function MemberWorkspaceProjectBoardView({
  projects,
  onAddProject,
  onEditProject,
  updateProjectStatusAction,
  showClosedProjects,
  hiddenWorkstreamCategoryKeys = [],
  onHiddenWorkstreamCategoryKeysChange,
  visibleProperties,
  workstreamCategories = [],
  createWorkstreamCategoryAction,
  updateWorkstreamCategoryAction,
  deleteWorkstreamCategoryAction,
  restoreWorkstreamDefaultsAction,
  updateProjectWorkstreamAction,
  coachOptions = [],
  canManageCoachAssignments = false,
  updateCoachAssignmentAction,
  canUnassignCoachAssignments = true,
  kanbanVisibilityMode = "visible",
  pendingVisibilityOrganizationIds = [],
  onOrganizationVisibilityChange,
}: MemberWorkspaceProjectBoardViewProps) {
  const router = useRouter()
  const [items, setItems] =
    useState<PlatformAdminDashboardLabProject[]>(projects)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pendingProjectIds, setPendingProjectIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const usesCustomWorkstreams = workstreamCategories.length > 0
  const canManageBoard = usesCustomWorkstreams
    ? Boolean(updateProjectWorkstreamAction)
    : Boolean(updateProjectStatusAction)
  const { allColumns, columns, hiddenCategories } =
    useMemberWorkspaceProjectBoardColumns({
      hiddenWorkstreamCategoryKeys,
      showClosedProjects,
      usesCustomWorkstreams,
      workstreamCategories,
    })

  useEffect(() => {
    setItems(projects)
  }, [projects])

  const groups = useMemo(() => {
    const grouped = new Map<string, PlatformAdminDashboardLabProject[]>()
    for (const column of allColumns) {
      grouped.set(column.id, [])
    }
    for (const project of items) {
      const statusCategory = allColumns.find(
        (column) => column.defaultKey === project.status
      )
      const columnId = usesCustomWorkstreams
        ? (project.workstreamCategoryId ??
          statusCategory?.id ??
          allColumns[0]?.id)
        : project.status

      if (!columnId || !grouped.has(columnId)) {
        continue
      }
      grouped.get(columnId)?.push(project)
    }
    return grouped
  }, [allColumns, items, usesCustomWorkstreams])

  const hideCategory = (categoryKey: string) => {
    onHiddenWorkstreamCategoryKeysChange?.(
      Array.from(new Set([...hiddenWorkstreamCategoryKeys, categoryKey]))
    )
  }

  const showCategory = (categoryKey: string) => {
    onHiddenWorkstreamCategoryKeysChange?.(
      hiddenWorkstreamCategoryKeys.filter((key) => key !== categoryKey)
    )
  }

  const commitProjectStatus = (
    projectId: string,
    status: PlatformAdminDashboardLabProject["status"]
  ) => {
    if (!updateProjectStatusAction) {
      return
    }

    const previousItems = items
    setItems((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, status } : project
      )
    )
    setPendingProjectIds((current) =>
      Array.from(new Set([...current, projectId]))
    )

    startTransition(async () => {
      const result = await updateProjectStatusAction(projectId, status)

      setPendingProjectIds((current) =>
        current.filter((value) => value !== projectId)
      )

      if ("error" in result) {
        setItems(previousItems)
        toast.error(result.error)
        return
      }

      router.refresh()
    })
  }

  const commitProjectWorkstream = (projectId: string, categoryId: string) => {
    if (!updateProjectWorkstreamAction) return

    const previousItems = items
    setItems((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, workstreamCategoryId: categoryId }
          : project
      )
    )
    setPendingProjectIds((current) =>
      Array.from(new Set([...current, projectId]))
    )

    startTransition(async () => {
      const result = await updateProjectWorkstreamAction(projectId, categoryId)
      setPendingProjectIds((current) =>
        current.filter((value) => value !== projectId)
      )

      if ("error" in result) {
        setItems(previousItems)
        toast.error(result.error)
        return
      }

      router.refresh()
    })
  }

  const moveProject = (projectId: string, columnId: string) => {
    if (usesCustomWorkstreams) {
      commitProjectWorkstream(projectId, columnId)
      return
    }
    commitProjectStatus(
      projectId,
      columnId as PlatformAdminDashboardLabProject["status"]
    )
  }

  const handleDropTo =
    (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const id = event.dataTransfer.getData("text/id")
      if (!id) return
      setDraggingId(null)
      moveProject(id, columnId)
    }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div className="min-w-0 space-y-3 p-3 sm:p-4">
      {usesCustomWorkstreams ? (
        <MemberWorkspaceProjectBoardCategoryToolbar
          createCategoryAction={createWorkstreamCategoryAction}
          hiddenCategories={hiddenCategories}
          onShowAllCategories={() => onHiddenWorkstreamCategoryKeysChange?.([])}
          onShowCategory={showCategory}
          restoreDefaultsAction={restoreWorkstreamDefaultsAction}
        />
      ) : null}

      <div className="grid w-full min-w-0 snap-x snap-proximity auto-cols-[calc(100%_-_1rem)] grid-flow-col items-start gap-3 overflow-x-auto pb-2 sm:auto-cols-[18rem] sm:gap-4 lg:auto-cols-[minmax(18rem,1fr)]">
        {columns.map((column) => (
          <div
            key={column.id}
            className="bg-muted flex max-h-[max(16rem,calc(100dvh-18rem))] min-h-0 min-w-0 snap-start flex-col overflow-hidden rounded-xl lg:max-h-[calc(100dvh-16rem)]"
            onDragOver={canManageBoard ? handleDragOver : undefined}
            onDrop={canManageBoard ? handleDropTo(column.id) : undefined}
          >
            <div className="flex shrink-0 items-center justify-between px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {column.defaultKey ? (
                  getColumnStatusIcon(
                    column.defaultKey as PlatformAdminDashboardLabProject["status"]
                  )
                ) : (
                  <StackSimple className="text-muted-foreground h-4 w-4" />
                )}
                <span className="min-w-0 break-words text-sm font-medium">
                  {column.label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {groups.get(column.id)?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {onAddProject ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-lg sm:size-7"
                    type="button"
                    onClick={onAddProject}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : null}
                {usesCustomWorkstreams && updateWorkstreamCategoryAction ? (
                  <MemberWorkspaceProjectBoardCategoryMenu
                    category={{
                      id: column.id,
                      name: column.label,
                      color: column.color,
                      position: 0,
                      defaultKey: column.defaultKey,
                    }}
                    deleteCategoryAction={deleteWorkstreamCategoryAction}
                    onHideCategory={
                      column.defaultKey
                        ? () => hideCategory(column.defaultKey as string)
                        : undefined
                    }
                    updateCategoryAction={updateWorkstreamCategoryAction}
                  />
                ) : null}
              </div>
            </div>
            <ScrollFadeEffect aria-label={`${column.label} projects`} tabIndex={0} className="min-h-0 space-y-3 overflow-y-auto overscroll-y-contain px-3 pb-3">
              {(groups.get(column.id) ?? []).map((project) => {
                const canManageProjectCard =
                  canManageBoard &&
                  (usesCustomWorkstreams ||
                    project.projectKind !== "organization_admin")

                return (
                  <div
                    key={project.id}
                    draggable={canManageProjectCard}
                    aria-disabled={pendingProjectIds.includes(project.id)}
                    className={
                      draggingId === project.id
                        ? "cursor-grabbing opacity-70"
                        : canManageProjectCard
                          ? "cursor-grab"
                          : ""
                    }
                    onDragStart={(event) => {
                      if (
                        !canManageProjectCard ||
                        pendingProjectIds.includes(project.id)
                      ) {
                        event.preventDefault()
                        return
                      }
                      event.dataTransfer.setData("text/id", project.id)
                      setDraggingId(project.id)
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <MemberWorkspaceProjectCard
                      project={project}
                      variant="board"
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
                            canManageCoachAssignments={
                              canManageCoachAssignments
                            }
                            canUnassignCoachAssignments={
                              canUnassignCoachAssignments
                            }
                            coachOptions={coachOptions}
                            kanbanVisibilityMode={kanbanVisibilityMode}
                            onOrganizationVisibilityChange={
                              onOrganizationVisibilityChange
                            }
                            pendingVisibilityOrganizationIds={
                              pendingVisibilityOrganizationIds
                            }
                            project={project}
                            updateCoachAssignmentAction={
                              updateCoachAssignmentAction
                            }
                          />
                        ) : canManageProjectCard ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-11 rounded-lg sm:size-7"
                                disabled={pendingProjectIds.includes(
                                  project.id
                                )}
                                type="button"
                              >
                                <DotsThreeVertical className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2" align="end">
                              <div className="space-y-1">
                                {columns.map((nextColumn) => (
                                  <button
                                    key={nextColumn.id}
                                    type="button"
                                    className="hover:bg-accent min-h-11 w-full rounded-md px-2 py-2 text-left text-sm sm:min-h-0 sm:py-1"
                                    onClick={() =>
                                      moveProject(project.id, nextColumn.id)
                                    }
                                  >
                                    Move to {nextColumn.label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : undefined
                      }
                    />
                  </div>
                )
              })}
              {onAddProject ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={onAddProject}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add project
                </Button>
              ) : null}
            </ScrollFadeEffect>
          </div>
        ))}
      </div>
    </div>
  )
}
