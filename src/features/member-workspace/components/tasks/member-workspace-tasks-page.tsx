"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Plus } from "@phosphor-icons/react/dist/ssr"
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"

import {
  Button,
  ChipOverflow,
  FilterPopover,
  type FilterPopoverMemberOption,
  type FilterPopoverTagOption,
  TAG_OPTIONS,
  TaskQuickCreateModal,
  type CreateTaskContext,
  type FilterChip,
  type ProjectTask,
  type ProjectTaskGroup,
  type TaskQuickCreateSubmitValue,
  ProjectTaskListView,
  computeTaskFilterCounts,
  filterTasksByChips,
} from "@/features/platform-admin-dashboard"
import { toProjectGroup } from "../../lib/task-view-model"
import { toast } from "@/lib/toast"
import type {
  MemberWorkspaceCreateTaskInput,
  MemberWorkspacePersonOption,
  MemberWorkspaceStorageMode,
  MemberWorkspaceTaskGroup,
  MemberWorkspaceTaskItem,
  MemberWorkspaceTaskStatus,
} from "../../types"
import { MemberWorkspaceClearStarterDataButton } from "../shared/member-workspace-clear-starter-data-button"

type MemberWorkspaceTaskFilterCounts = {
  status?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
}

function updateTaskGroups(
  groups: MemberWorkspaceTaskGroup[],
  taskId: string,
  updater: (task: MemberWorkspaceTaskItem) => MemberWorkspaceTaskItem,
) {
  return groups.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
  }))
}

export function MemberWorkspaceTasksPage({
  initialTaskGroups,
  storageMode: _storageMode,
  starterTaskCount: _starterTaskCount,
  hasAnyOrgTasks,
  canResetStarterData,
  canManageTasks,
  clearStarterDataAction,
  updateTaskStatusAction,
  createTaskAction,
  updateTaskAction,
  updateTaskOrderAction,
  assigneeOptions,
  projectOptions,
  scope,
}: {
  initialTaskGroups: MemberWorkspaceTaskGroup[]
  storageMode: MemberWorkspaceStorageMode
  starterTaskCount: number
  hasAnyOrgTasks: boolean
  canResetStarterData: boolean
  canManageTasks: boolean
  clearStarterDataAction?: () => Promise<{ ok: true } | { error: string }>
  updateTaskStatusAction?: (
    taskId: string,
    nextStatus: MemberWorkspaceTaskStatus,
  ) => Promise<{ ok: true; taskId: string; status: MemberWorkspaceTaskStatus } | { error: string }>
  createTaskAction?: (
    input: MemberWorkspaceCreateTaskInput,
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  updateTaskAction?: (
    taskId: string,
    input: MemberWorkspaceCreateTaskInput,
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  updateTaskOrderAction?: (
    projectId: string,
    orderedTaskIds: string[],
  ) => Promise<{ ok: true; projectId: string } | { error: string }>
  assigneeOptions: MemberWorkspacePersonOption[]
  projectOptions: Array<{ id: string; label: string }>
  scope: "organization" | "platform-admin"
}) {
  const router = useRouter()
  const [groups, setGroups] = useState(initialTaskGroups)
  useEffect(() => setGroups(initialTaskGroups), [initialTaskGroups])
  const [filters, setFilters] = useState<FilterChip[]>([])
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined)
  const [, startMutationTransition] = useTransition()

  const adaptedGroups = useMemo(() => groups.map(toProjectGroup), [groups])
  const allTasks = useMemo(
    () => adaptedGroups.flatMap((group) => group.tasks),
    [adaptedGroups],
  )
  const counts = useMemo<MemberWorkspaceTaskFilterCounts>(() => {
    return computeTaskFilterCounts(allTasks, filters)
  }, [allTasks, filters])

  const visibleGroups = useMemo<ProjectTaskGroup[]>(() => {
    if (!filters.length) return adaptedGroups

    return adaptedGroups
      .map((group) => ({
        project: group.project,
        tasks: filterTasksByChips(group.tasks, filters),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [adaptedGroups, filters])

  const memberFilterOptions = useMemo<FilterPopoverMemberOption[]>(() => {
    const options = new Map<string, FilterPopoverMemberOption>()

    if (allTasks.some((task) => !task.assignee)) {
      options.set("no-member", {
        id: "no-member",
        label: "No member",
        countKey: "no-member",
      })
    }

    for (const task of allTasks) {
      const assignee = task.assignee
      if (!assignee) continue
      const key = assignee.name.trim().toLowerCase()
      if (options.has(key)) continue
      options.set(key, {
        id: assignee.id,
        label: assignee.name,
        avatar: assignee.avatarUrl ?? undefined,
        countKey: key,
      })
    }

    return Array.from(options.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    )
  }, [allTasks])

  const tagFilterOptions = useMemo<FilterPopoverTagOption[]>(() => {
    const options = new Map<string, FilterPopoverTagOption>()

    for (const task of allTasks) {
      const tag = task.tag?.trim()
      if (!tag) continue
      const key = tag.toLowerCase()
      if (options.has(key)) continue
      options.set(key, {
        id: key,
        label: tag,
        countKey: key,
        value: key,
      })
    }

    return Array.from(options.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    )
  }, [allTasks])

  const workstreamOptionsByProjectId = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group.projectId,
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

  const findTaskItem = (taskId: string) =>
    groups.flatMap((group) => group.tasks).find((task) => task.id === taskId)

  const openCreateTask = (context?: CreateTaskContext) => {
    setEditingTask(undefined)
    setCreateContext(context)
    setIsTaskCreateOpen(true)
  }

  const openEditTask = (task: ProjectTask) => {
    const sourceTask = findTaskItem(task.id)
    if (!sourceTask?.canUpdate || !updateTaskAction || !canManageTasks) {
      return
    }

    setCreateContext(undefined)
    setEditingTask(task)
    setIsTaskCreateOpen(true)
  }

  const handleTaskSubmit = async (value: TaskQuickCreateSubmitValue) => {
    const tagLabel = value.tagLabel?.trim() || TAG_OPTIONS.find((option) => option.id === value.tagId)?.label
    const startDate =
      format(value.startDate ?? new Date(), "yyyy-MM-dd")
    const endDate = value.targetDate ? format(value.targetDate, "yyyy-MM-dd") : startDate
    const input: MemberWorkspaceCreateTaskInput = {
      projectId: value.projectId,
      title: value.title,
      description: value.description,
      status: value.status,
      startDate,
      endDate,
      priority: value.priorityId,
      tagLabel,
      workstreamName: value.workstreamName,
      assigneeUserId: value.assigneeId,
    }
    const result = editingTask
      ? updateTaskAction
        ? await updateTaskAction(editingTask.id, input)
        : { error: "Task editing is unavailable." }
      : createTaskAction
        ? await createTaskAction(input)
        : { error: "Task creation is unavailable." }

    if ("error" in result) {
      return result
    }

    router.refresh()
    return result
  }

  const handleToggleTask = (taskId: string) => {
    if (!canManageTasks || !updateTaskStatusAction) {
      return
    }

    const currentTask = groups
      .flatMap((group) => group.tasks)
      .find((task) => task.id === taskId)
    if (!currentTask) return

    const nextStatus: MemberWorkspaceTaskStatus =
      currentTask.status === "done" ? "todo" : "done"
    const previousGroups = groups

    setGroups((current) =>
      updateTaskGroups(current, taskId, (task) => ({
        ...task,
        status: nextStatus,
      })),
    )
    startMutationTransition(async () => {
      const result = await updateTaskStatusAction(taskId, nextStatus)
      if ("error" in result) {
        toast.error(result.error)
        setGroups(previousGroups)
      }
    })
  }

  const canReorderTasks =
    canManageTasks && Boolean(updateTaskOrderAction) && filters.length === 0

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorderTasks || !updateTaskOrderAction) {
      return
    }

    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const activeGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === activeId),
    )
    const overGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === overId),
    )

    if (activeGroupIndex === -1 || overGroupIndex === -1 || activeGroupIndex !== overGroupIndex) {
      return
    }

    const group = groups[activeGroupIndex]
    const oldIndex = group.tasks.findIndex((task) => task.id === activeId)
    const newIndex = group.tasks.findIndex((task) => task.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const previousGroups = groups
    const reorderedTasks = arrayMove(group.tasks, oldIndex, newIndex)
    const nextGroups = groups.map((item, index) =>
      index === activeGroupIndex
        ? { ...item, tasks: reorderedTasks }
        : item,
    )

    setGroups(nextGroups)
    startMutationTransition(async () => {
      const result = await updateTaskOrderAction(
        group.projectId,
        reorderedTasks.map((task) => task.id),
      )

      if ("error" in result) {
        toast.error(result.error)
        setGroups(previousGroups)
        return
      }

      router.refresh()
    })
  }

  const canOpenTaskCreate =
    canManageTasks && Boolean(createTaskAction) && projectOptions.length > 0

  const header = (
    <header className="flex flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <p className="text-base font-medium text-foreground">Tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {canResetStarterData && clearStarterDataAction ? (
            <MemberWorkspaceClearStarterDataButton
              clearStarterDataAction={clearStarterDataAction}
            />
          ) : null}
          {canManageTasks ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCreateTask()}
              disabled={!canOpenTaskCreate}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <FilterPopover
            initialChips={filters}
            onApply={setFilters}
            onClear={() => setFilters([])}
            counts={counts}
            memberOptions={memberFilterOptions}
            tagOptions={tagFilterOptions}
          />
          <ChipOverflow
            chips={filters}
            onRemove={(key, value) =>
              setFilters((prev) => prev.filter((chip) => !(chip.key === key && chip.value === value)))
            }
            maxVisible={6}
          />
        </div>
      </div>
    </header>
  )

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background min-w-0">
      {header}

      {!visibleGroups.length ? (
        <div className="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">
          {filters.length > 0
            ? "No tasks match the current filters."
            : hasAnyOrgTasks
              ? "No tasks assigned to you yet."
              : canOpenTaskCreate
                ? scope === "platform-admin"
                  ? "No tasks available yet."
                  : "No tasks available for this organization yet."
                : "Create a project first to start adding tasks."}
        </div>
      ) : (
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={canReorderTasks ? handleDragEnd : undefined}
          >
            <ProjectTaskListView
              flat
              groups={visibleGroups}
              onToggleTask={handleToggleTask}
              onAddTask={(context) => openCreateTask(context)}
              onOpenTask={canManageTasks ? openEditTask : undefined}
              canReorder={canReorderTasks}
            />
          </DndContext>
        </div>
      )}

      <TaskQuickCreateModal
        open={isTaskCreateOpen}
        onClose={() => {
          setIsTaskCreateOpen(false)
          setEditingTask(undefined)
          setCreateContext(undefined)
        }}
        context={editingTask ? undefined : createContext}
        editingTask={editingTask}
        projectOptions={projectOptions}
        workstreamOptionsByProjectId={workstreamOptionsByProjectId}
        assigneeOptions={assigneeOptions}
        onSubmitTask={handleTaskSubmit}
      />
    </div>
  )
}
