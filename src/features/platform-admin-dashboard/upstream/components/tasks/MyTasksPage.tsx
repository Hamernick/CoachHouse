"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ChartBar, DotsSixVertical, FolderSimple, Plus } from "@phosphor-icons/react/dist/ssr"
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { projects, type Project, type FilterCounts } from "@/features/platform-admin-dashboard/upstream/lib/data/projects"
import { getProjectDetailsById, getProjectTasks, type ProjectTask } from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"
import { DEFAULT_VIEW_OPTIONS, type FilterChip as FilterChipType, type ViewOptions } from "@/features/platform-admin-dashboard/upstream/lib/view-options"
import { TaskWeekBoardView } from "@/features/platform-admin-dashboard/upstream/components/tasks/TaskWeekBoardView"
import {
  ProjectTaskGroup,
  ProjectTaskListView,
  filterTasksByChips,
  computeTaskFilterCounts,
  ProjectTasksSection,
} from "@/features/platform-admin-dashboard/upstream/components/tasks/task-helpers"
import { TaskRowBase } from "@/features/platform-admin-dashboard/upstream/components/tasks/TaskRowBase"
import { Button } from "@/features/platform-admin-dashboard/upstream/components/ui/button"
import { SidebarTrigger } from "@/features/platform-admin-dashboard/upstream/components/ui/sidebar"
import { Badge } from "@/features/platform-admin-dashboard/upstream/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/features/platform-admin-dashboard/upstream/components/ui/avatar"
import { ProgressCircle } from "@/features/platform-admin-dashboard/upstream/components/progress-circle"
import { FilterPopover } from "@/features/platform-admin-dashboard/upstream/components/filter-popover"
import { ChipOverflow } from "@/features/platform-admin-dashboard/upstream/components/chip-overflow"
import { ViewOptionsPopover } from "@/features/platform-admin-dashboard/upstream/components/view-options-popover"
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils"
import { TaskQuickCreateModal, type CreateTaskContext } from "@/features/platform-admin-dashboard/upstream/components/tasks/TaskQuickCreateModal"

export function MyTasksPage() {
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(() => {
    return projects
      .map((project) => {
        const details = getProjectDetailsById(project.id)
        const tasks = getProjectTasks(details)
        return { project, tasks }
      })
      .filter((group) => group.tasks.length > 0)
  })

  const [filters, setFilters] = useState<FilterChipType[]>([])
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const counts = useMemo<FilterCounts>(() => {
    const allTasks = groups.flatMap((g) => g.tasks)
    return computeTaskFilterCounts(allTasks)
  }, [groups])

  const visibleGroups = useMemo<ProjectTaskGroup[]>(() => {
    if (!filters.length) return groups

    return groups
      .map((group) => ({
        project: group.project,
        tasks: filterTasksByChips(group.tasks, filters),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, filters])

  const allVisibleTasks = useMemo<ProjectTask[]>(() => {
    return visibleGroups.flatMap((group) => group.tasks)
  }, [visibleGroups])

  const projectOptions = useMemo(
    () => groups.map((group) => ({ id: group.project.id, label: group.project.name })),
    [groups],
  )

  const workstreamOptionsByProjectId = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group.project.id,
          Array.from(
            new Map(
              group.tasks
                .map((task) => task.workstreamName)
                .filter((workstream): workstream is string => Boolean(workstream))
                .map((workstream) => [workstream, { id: workstream, label: workstream }]),
            ).values(),
          ),
        ]),
      ),
    [groups],
  )

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          groups
            .flatMap((group) => group.tasks)
            .map((task) => task.assignee)
            .filter((assignee): assignee is NonNullable<ProjectTask["assignee"]> => Boolean(assignee))
            .map((assignee) => [
              assignee.id,
              {
                id: assignee.id,
                name: assignee.name,
                avatarUrl: assignee.avatarUrl ?? undefined,
              },
            ]),
        ).values(),
      ),
    [groups],
  )

  const openCreateTask = (context?: CreateTaskContext) => {
    setEditingTask(undefined)
    setCreateContext(context)
    setIsCreateTaskOpen(true)
  }

  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task)
    setCreateContext(undefined)
    setIsCreateTaskOpen(true)
  }

  const handleTaskCreated = (task: ProjectTask) => {
    setGroups((prev) => {
      const projectExists = prev.some((g) => g.project.id === task.projectId)
      const project = projects.find((p) => p.id === task.projectId)

      const ensureGroup = (current: ProjectTaskGroup[]): ProjectTaskGroup[] => {
        if (projectExists || !project) return current
        const details = getProjectDetailsById(project.id)
        const existingTasks = getProjectTasks(details)
        return [
          { project, tasks: [...existingTasks, task] },
          ...current,
        ]
      }

      const next = prev.map((group) => {
        if (group.project.id !== task.projectId) return group
        return {
          ...group,
          tasks: [...group.tasks, task],
        }
      })

      return ensureGroup(next)
    })
  }

  const toggleTask = (taskId: string) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: task.status === "done" ? "todo" : "done",
              }
            : task,
        ),
      })),
    )
  }

  const changeTaskTag = (taskId: string, tagLabel?: string) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                tag: tagLabel,
              }
            : task,
        ),
      })),
    )
  }

  const moveTaskDate = (taskId: string, newDate: Date) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                startDate: newDate,
              }
            : task,
        ),
      })),
    )
  }

  const handleTaskUpdated = (updated: ProjectTask) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.project.id === updated.projectId
          ? {
              ...group,
              tasks: group.tasks.map((task) => (task.id === updated.id ? updated : task)),
            }
          : group,
      ),
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Find the group containing the active task
    const activeGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === active.id)
    )

    if (activeGroupIndex === -1) return

    const activeGroup = groups[activeGroupIndex]

    // Find the group containing the over task
    const overGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === over.id)
    )

    if (overGroupIndex === -1) return

    // For now, only allow reordering within the same group
    if (activeGroupIndex !== overGroupIndex) return

    const activeIndex = activeGroup.tasks.findIndex((task) => task.id === active.id)
    const overIndex = activeGroup.tasks.findIndex((task) => task.id === over.id)

    if (activeIndex === -1 || overIndex === -1) return

    const reorderedTasks = arrayMove(activeGroup.tasks, activeIndex, overIndex)

    setGroups((prev) =>
      prev.map((group, index) =>
        index === activeGroupIndex ? { ...group, tasks: reorderedTasks } : group
      )
    )
  }

  if (!visibleGroups.length) {
    return (
      <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/70">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground">No tasks available yet.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCreateTask()}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <FilterPopover
              initialChips={filters}
              onApply={setFilters}
              onClear={() => setFilters([])}
              counts={counts}
            />
            <ChipOverflow
              chips={filters}
              onRemove={(key, value) =>
                setFilters((prev) => prev.filter((chip) => !(chip.key === key && chip.value === value)))
              }
              maxVisible={6}
            />
          </div>
          <div className="flex items-center gap-2">
            <ViewOptionsPopover options={viewOptions} onChange={setViewOptions} allowedViewTypes={["list", "board"]} />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
        {viewOptions.viewType === "list" && (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <ProjectTaskListView
              groups={visibleGroups}
              onToggleTask={toggleTask}
              onAddTask={(context) => openCreateTask(context)}
            />
          </DndContext>
        )}
        {viewOptions.viewType === "board" && (
          <TaskWeekBoardView
            tasks={allVisibleTasks}
            onAddTask={(context) => openCreateTask(context)}
            onToggleTask={toggleTask}
            onChangeTag={changeTaskTag}
            onMoveTaskDate={moveTaskDate}
            onOpenTask={openEditTask}
          />
        )}
      </div>

      <TaskQuickCreateModal
        open={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false)
          setEditingTask(undefined)
          setCreateContext(undefined)
        }}
        context={editingTask ? undefined : createContext}
        onTaskCreated={handleTaskCreated}
        editingTask={editingTask}
        onTaskUpdated={handleTaskUpdated}
        projectOptions={projectOptions}
        workstreamOptionsByProjectId={workstreamOptionsByProjectId}
        assigneeOptions={assigneeOptions}
      />
    </div>
  )
}
