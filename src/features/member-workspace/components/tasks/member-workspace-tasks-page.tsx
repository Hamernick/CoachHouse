"use client"

import { useEffect, useMemo, useState } from "react"
import { useVisibleRefresh } from "@/hooks/use-visible-refresh"
import { useRouter, useSearchParams } from "next/navigation"
import { TaskRelationshipSelect, TaskPresentationControls } from "./task-presentation-controls"
import { selectPersonalTaskGroups } from "../../lib/task-presentation"
import { format } from "date-fns"
import { Plus } from "@phosphor-icons/react/dist/ssr"

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
  computeTaskFilterCounts,
  filterTasksByChips,
} from "@/features/platform-admin-dashboard"
import { TaskProjectList } from "./task-project-list"
import { TaskWeekBoard } from "./task-week-board"
import { useTaskCalendarDay } from "./use-task-calendar-day"
import { useTaskMutations, type TaskMutationActions } from "./use-task-mutations"
import { readTaskViewState, writeTaskViewState, type TaskViewState } from "../../lib/task-view-state"
import { toProjectGroup } from "../../lib/task-view-model"
import { upsertPersonalTask } from "../../lib/saved-task"
import type {
  MemberWorkspaceCreateTaskInput,
  MemberWorkspacePersonOption,
  MemberWorkspaceStorageMode,
  MemberWorkspaceTaskGroup,
} from "../../types"
import { MemberWorkspaceClearStarterDataButton } from "../shared/member-workspace-clear-starter-data-button"

type MemberWorkspaceTaskFilterCounts = {
  status?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
}

export function MemberWorkspaceTasksPage({
  initialTaskGroups,
  viewerUserId,
  storageMode: _storageMode,
  starterTaskCount: _starterTaskCount,
  hasAnyOrgTasks,
  canResetStarterData,
  canManageTasks,
  clearStarterDataAction,
  updateTaskStatusAction,
  createTaskAction,
  updateTaskAction,
  scheduleTaskAction,
  moveTaskAction,
  assigneeOptions,
  projectOptions,
  scope,
}: TaskMutationActions & {
  viewerUserId: string
  initialTaskGroups: MemberWorkspaceTaskGroup[]
  storageMode: MemberWorkspaceStorageMode
  starterTaskCount: number
  hasAnyOrgTasks: boolean
  canResetStarterData: boolean
  canManageTasks: boolean
  clearStarterDataAction?: () => Promise<{ ok: true } | { error: string }>
  createTaskAction?: (
    input: MemberWorkspaceCreateTaskInput,
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  updateTaskAction?: (
    taskId: string,
    input: MemberWorkspaceCreateTaskInput,
  ) => Promise<{ ok: true; taskId: string } | { error: string }>
  assigneeOptions: MemberWorkspacePersonOption[]
  projectOptions: Array<{ id: string; label: string }>
  scope: "organization" | "platform-admin"
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = useTaskCalendarDay()
  const [state, setState] = useState(() => readTaskViewState(new URLSearchParams(searchParams.toString()), today))
  useEffect(() => {
    // Next commits native-history search params in a transition. An older URL
    // snapshot must not overwrite a more recent checkbox or display change.
    if (searchParams.toString() !== new URLSearchParams(window.location.search).toString()) return
    setState(readTaskViewState(new URLSearchParams(searchParams.toString()), today))
  }, [searchParams, today])
  const { filters, relation } = state
  const changeViewState = (patch: Partial<TaskViewState>) => {
    const current = new URLSearchParams(window.location.search)
    const nextState = { ...readTaskViewState(current, today), ...patch }
    setState(nextState)
    const next = writeTaskViewState(current, nextState)
    window.history.pushState(null, "", `${window.location.pathname}?${next.toString()}`)
  }
  const setFilters = (next: FilterChip[]) => changeViewState({ filters: next })
  const { groups, setGroups, pendingTaskIds, capabilities, toggleTask, scheduleTask, moveTask } = useTaskMutations({
    initialTaskGroups, canManageTasks, canEditTasks: Boolean(updateTaskAction), actions: { updateTaskStatusAction, scheduleTaskAction, moveTaskAction }, refresh: router.refresh,
  })
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)
  const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined)
  const mutationPending = pendingTaskIds.size > 0
  useVisibleRefresh(router.refresh, !isTaskCreateOpen && !mutationPending)

  const selectedGroups = useMemo(() => selectPersonalTaskGroups(groups, viewerUserId, state), [groups, viewerUserId, state])
  const adaptedGroups = useMemo(() => selectedGroups.map(toProjectGroup), [selectedGroups])
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
    setCreateContext({ ...context, projectId: context?.projectId ?? (projectOptions.length === 1 ? projectOptions[0].id : undefined) })
    setIsTaskCreateOpen(true)
  }

  const openEditTask = (task: ProjectTask) => {
    const sourceTask = findTaskItem(task.id)
    if (!sourceTask || !capabilities(sourceTask).details || pendingTaskIds.has(task.id) || !updateTaskAction) {
      return
    }

    setCreateContext(undefined)
    setEditingTask(task)
    setIsTaskCreateOpen(true)
  }

  const handleTaskSubmit = async (value: TaskQuickCreateSubmitValue) => {
    const tagLabel = value.tagLabel?.trim() || TAG_OPTIONS.find((option) => option.id === value.tagId)?.label
    const startDate =
      value.startDate ? format(value.startDate, "yyyy-MM-dd") : ""
    const endDate = value.targetDate ? format(value.targetDate, "yyyy-MM-dd") : ""
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

    setGroups(current => upsertPersonalTask(current, result.taskId, input, projectOptions.find(project => project.id === input.projectId)?.label ?? "Project", assigneeOptions, viewerUserId))
    router.refresh()
    return result
  }

  const visibleIds = new Set(visibleGroups.flatMap(group => group.tasks.map(task => task.id)))
  const visibleTaskGroups = selectedGroups.map(group => ({ ...group, tasks: group.tasks.filter(task => visibleIds.has(task.id)) })).filter(group => group.tasks.length)
  const openTaskById = (id: string) => {
    const task = visibleGroups.flatMap(group => group.tasks).find(item => item.id === id)
    if (task) openEditTask(task)
  }

  const canOpenTaskCreate =
    !mutationPending && canManageTasks && Boolean(createTaskAction) && projectOptions.length > 0

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

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TaskRelationshipSelect value={relation} onChange={(relation) => changeViewState({ relation })} />
          <FilterPopover
            entityType="task"
            applyOnChange
            initialChips={filters}
            onApply={setFilters}
            onClear={() => setFilters([])}
            counts={counts}
            memberOptions={memberFilterOptions}
            tagOptions={tagFilterOptions}
          />
          <TaskPresentationControls state={state} onChange={changeViewState} />
          <ChipOverflow
            chips={filters}
            onRemove={(key, value) =>
              setFilters(filters.filter((chip) => !(chip.key === key && chip.value === value)))
            }
            maxVisible={6}
          />
        </div>
        <div className="flex shrink-0 items-center rounded-lg border border-border p-1" role="group" aria-label="Task view">
          {(["list", "board"] as const).map(view => (
            <Button key={view} size="sm" variant={state.view === view ? "secondary" : "ghost"} aria-pressed={state.view === view} className="min-h-10 sm:min-h-8" onClick={() => changeViewState({ view })}>
              {view === "list" ? "List" : "Board"}
            </Button>
          ))}
        </div>
      </div>
    </header>
  )

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background min-w-0">
      {header}

      {state.view === "list" && !visibleGroups.length ? (
        <div className="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">
          {filters.length > 0 || state.completion !== "all"
            ? "No tasks match the current filters."
            : hasAnyOrgTasks
              ? relation.length === 1 && relation[0] === "owned" ? "No tasks assigned to you yet." : "No tasks in this view."
              : canOpenTaskCreate
                ? scope === "platform-admin"
                  ? "No tasks available yet."
                  : "No tasks available for this organization yet."
                : "Create a project first to start adding tasks."}
        </div>
      ) : (
        <div className="flex-1 min-h-0 min-w-0 space-y-4 overflow-y-auto px-4 py-4">
          {state.view === "board" ? (today ? (
            <TaskWeekBoard tasks={visibleTaskGroups.flatMap(group => group.tasks)}
              weekStart={state.week || today} today={today} showWeekend={state.weekend}
              onWeekChange={week => changeViewState({ week })}
              onWeekendChange={weekend => changeViewState({ weekend })}
              pendingTaskIds={pendingTaskIds} capabilities={capabilities}
              onToggleTask={toggleTask} onOpenTask={openTaskById} onScheduleTask={scheduleTask}
              onAddTask={canOpenTaskCreate ? context => openCreateTask({ ...context, projectId: projectOptions.some(project => project.id === context.projectId) ? context.projectId : undefined }) : undefined}
              onShowList={() => changeViewState({ view: "list" })} />
          ) : <p role="status" className="text-sm text-muted-foreground">Loading task calendar…</p>) : (
            <TaskProjectList groups={visibleTaskGroups} pendingTaskIds={pendingTaskIds} capabilities={capabilities}
              onToggleTask={toggleTask} onOpenTask={openTaskById}
              onAddTask={canOpenTaskCreate ? context => openCreateTask(context) : undefined}
              canAddTask={projectId => projectOptions.some(project => project.id === projectId)}
              onMoveTask={moveTaskAction && state.ordering === "manual" ? moveTask : undefined} />
          )}
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
        hideUnsupportedControls
        requireProjectSelection
      />
    </div>
  )
}
