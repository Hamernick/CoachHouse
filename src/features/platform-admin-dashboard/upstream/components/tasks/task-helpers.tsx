"use client"

import { format } from "date-fns"
import { ChartBar, DotsSixVertical, FolderSimple, Plus } from "@phosphor-icons/react/dist/ssr"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import type { Project, FilterCounts } from "@/features/platform-admin-dashboard/upstream/lib/data/projects"
import type { ProjectTask } from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"
import { TaskRowBase } from "@/features/platform-admin-dashboard/upstream/components/tasks/TaskRowBase"
import { Button } from "@/features/platform-admin-dashboard/upstream/components/ui/button"
import { Badge } from "@/features/platform-admin-dashboard/upstream/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/features/platform-admin-dashboard/upstream/components/ui/avatar"
import { ProgressCircle } from "@/features/platform-admin-dashboard/upstream/components/progress-circle"
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils"
import type { FilterChip as FilterChipType } from "@/features/platform-admin-dashboard/upstream/lib/view-options"
import type { CreateTaskContext } from "@/features/platform-admin-dashboard/upstream/components/tasks/TaskQuickCreateModal"

export type ProjectTaskGroup = {
  project: Project
  tasks: ProjectTask[]
}

type TaskFilterBuckets = {
  status: Set<string>
  priority: Set<string>
  tags: Set<string>
  members: Set<string>
}

type TaskFilterCategory = keyof TaskFilterBuckets

function normalizeTaskFilterBuckets(chips: FilterChipType[]): TaskFilterBuckets {
  const buckets: TaskFilterBuckets = {
    status: new Set<string>(),
    priority: new Set<string>(),
    tags: new Set<string>(),
    members: new Set<string>(),
  }

  for (const chip of chips) {
    const key = chip.key.trim().toLowerCase()
    const value = chip.value.trim().toLowerCase()

    if (key.startsWith("status")) {
      buckets.status.add(value)
      continue
    }

    if (key.startsWith("priority")) {
      buckets.priority.add(value)
      continue
    }

    if (key.startsWith("tag")) {
      buckets.tags.add(value)
      continue
    }

    if (key === "pic" || key.startsWith("member")) {
      buckets.members.add(value)
    }
  }

  return buckets
}

function matchesMemberFilter(task: ProjectTask, filters: Set<string>) {
  if (filters.has("no member") && !task.assignee) {
    return true
  }

  if (
    (filters.has("current member") || filters.has("current")) &&
    task.assignee
  ) {
    return true
  }

  const assigneeName = task.assignee?.name.trim().toLowerCase() ?? ""
  if (!assigneeName) {
    return false
  }

  for (const value of filters) {
    if (value === "no member" || value === "current member" || value === "current") {
      continue
    }
    if (assigneeName === value) {
      return true
    }
  }

  return false
}

function applyTaskFilters({
  excludeCategory,
  filters,
  tasks,
}: {
  excludeCategory?: TaskFilterCategory
  filters: TaskFilterBuckets
  tasks: ProjectTask[]
}) {
  return tasks.filter((task) => {
    if (
      excludeCategory !== "status" &&
      filters.status.size > 0 &&
      !filters.status.has(task.status.toLowerCase())
    ) {
      return false
    }

    if (
      excludeCategory !== "priority" &&
      filters.priority.size > 0 &&
      !filters.priority.has((task.priority ?? "no-priority").toLowerCase())
    ) {
      return false
    }

    if (
      excludeCategory !== "tags" &&
      filters.tags.size > 0 &&
      !filters.tags.has((task.tag ?? "").trim().toLowerCase())
    ) {
      return false
    }

    if (
      excludeCategory !== "members" &&
      filters.members.size > 0 &&
      !matchesMemberFilter(task, filters.members)
    ) {
      return false
    }

    return true
  })
}

export function filterTasksByChips(tasks: ProjectTask[], chips: FilterChipType[]): ProjectTask[] {
  if (!chips.length) return tasks

  return applyTaskFilters({
    filters: normalizeTaskFilterBuckets(chips),
    tasks,
  })
}

function countTasksByCategory(tasks: ProjectTask[]): FilterCounts {
  const counts: FilterCounts = {
    status: {},
    priority: {},
    tags: {},
    members: {},
  }

  for (const task of tasks) {
    const statusKey = task.status.toLowerCase()
    counts.status![statusKey] = (counts.status![statusKey] ?? 0) + 1

    const priorityKey = (task.priority ?? "no-priority").toLowerCase()
    counts.priority![priorityKey] = (counts.priority![priorityKey] ?? 0) + 1

    if (task.tag) {
      const tagKey = task.tag.trim().toLowerCase()
      counts.tags![tagKey] = (counts.tags![tagKey] ?? 0) + 1
    }

    if (!task.assignee) {
      counts.members!["no-member"] = (counts.members!["no-member"] || 0) + 1
    } else {
      counts.members!.current = (counts.members!.current || 0) + 1

      const name = task.assignee.name.trim().toLowerCase()
      counts.members![name] = (counts.members![name] || 0) + 1
    }
  }

  return counts
}

export function computeTaskFilterCounts(
  tasks: ProjectTask[],
  chips: FilterChipType[] = [],
): FilterCounts {
  const filters = normalizeTaskFilterBuckets(chips)

  return {
    status: countTasksByCategory(
      applyTaskFilters({
        excludeCategory: "status",
        filters,
        tasks,
      }),
    ).status,
    priority: countTasksByCategory(
      applyTaskFilters({
        excludeCategory: "priority",
        filters,
        tasks,
      }),
    ).priority,
    tags: countTasksByCategory(
      applyTaskFilters({
        excludeCategory: "tags",
        filters,
        tasks,
      }),
    ).tags,
    members: countTasksByCategory(
      applyTaskFilters({
        excludeCategory: "members",
        filters,
        tasks,
      }),
    ).members,
  }
}

export function getTaskDescriptionSnippet(task: ProjectTask): string {
  if (!task.description) return ""
  const plain = task.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return plain
}

export type ProjectTasksSectionProps = {
  group: ProjectTaskGroup
  onToggleTask: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
  onOpenTask?: (task: ProjectTask) => void
  canReorder?: boolean
}

export function ProjectTasksSection({
  group,
  onToggleTask,
  onAddTask,
  onOpenTask,
  canReorder = true,
}: ProjectTasksSectionProps) {
  const { project, tasks } = group
  const total = tasks.length
  const done = tasks.filter((t) => t.status === "done").length
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <section className="max-w-6xl mx-auto rounded-3xl border border-border bg-muted shadow-[var(--shadow-workstream)] p-3 space-y-2">
      <header className="flex items-center justify-between gap-4 px-0 py-1">
        <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
          <FolderSimple className="h-5 w-5" weight="regular" />
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-sm font-semibold leading-tight">{project.name}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ChartBar className="h-3 w-3" weight="regular" />
              <span className="font-medium">{capitalize(project.priority)}</span>
            </span>
            <div className="h-4 w-px bg-border/70 hidden sm:inline" />
            {project.typeLabel && project.durationLabel && (
              <>
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium hidden sm:inline">
                  {project.typeLabel} {project.durationLabel}
                </span>
                <div className="h-4 w-px bg-border/70 hidden sm:inline" />
              </>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium hidden sm:inline">
              {getProjectStatusLabel(project.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">
            {done}/{total}
          </span>
          <ProgressCircle progress={percent} color="var(--chart-2)" size={18} />
          <div className="h-4 w-px bg-border/80" />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 rounded-full text-muted-foreground hover:bg-transparent"
            aria-label="Add task"
            onClick={() =>
              onAddTask({
                projectId: project.id,
                workstreamName: tasks[0]?.workstreamName,
              })
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-1 px-2 py-3 bg-background rounded-2xl border border-border">
        {canReorder ? (
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskRowDnD
                key={task.id}
                task={task}
                onToggle={() => onToggleTask(task.id)}
                onOpen={() => onOpenTask?.(task)}
                canReorder
              />
            ))}
          </SortableContext>
        ) : (
          tasks.map((task) => (
            <TaskRowDnD
              key={task.id}
              task={task}
              onToggle={() => onToggleTask(task.id)}
              onOpen={() => onOpenTask?.(task)}
              canReorder={false}
            />
          ))
        )}
      </div>
    </section>
  )
}

export type TaskBadgesProps = {
  workstreamName?: string
  className?: string
}

export function TaskBadges({ workstreamName, className }: TaskBadgesProps) {
  if (!workstreamName) return null

  return (
    <Badge variant="muted" className={cn("whitespace-nowrap text-[11px]", className)}>
      {workstreamName}
    </Badge>
  )
}

export type TaskStatusProps = {
  status: ProjectTask["status"]
}

export function TaskStatus({ status }: TaskStatusProps) {
  const label = getStatusLabel(status)
  const color = getStatusColor(status)

  return <span className={cn("font-medium", color)}>{label}</span>
}

function getStatusLabel(status: ProjectTask["status"]): string {
  switch (status) {
    case "done":
      return "Done"
    case "in-progress":
      return "In Progress"
    default:
      return "To do"
  }
}

function getStatusColor(status: ProjectTask["status"]): string {
  switch (status) {
    case "done":
      return "text-emerald-500"
    case "in-progress":
      return "text-amber-500"
    default:
      return "text-muted-foreground"
  }
}

function getProjectStatusLabel(status: Project["status"]): string {
  switch (status) {
    case "active":
      return "In Progress"
    case "planned":
      return "Planned"
    case "backlog":
      return "Backlog"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return capitalize(status)
  }
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export type TaskPriorityProps = {
  priority: NonNullable<ProjectTask["priority"]>
  className?: string
}

export function TaskPriority({ priority, className }: TaskPriorityProps) {
  const label = getPriorityLabel(priority)

  return (
    <span className={cn("rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
      {label}
    </span>
  )
}

function getPriorityLabel(priority: NonNullable<ProjectTask["priority"]>): string {
  switch (priority) {
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
    case "urgent":
      return "Urgent"
    default:
      return "No priority"
  }
}

export type TaskRowDnDProps = {
  task: ProjectTask
  onToggle: () => void
  onOpen?: () => void
  canReorder?: boolean
  organizationName?: string
}

export function TaskRowDnD({ task, onToggle, onOpen, canReorder = true, organizationName }: TaskRowDnDProps) {
  const isDone = task.status === "done"

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canReorder,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (!onOpen) return
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpen()
          }
        }}
      >
        <TaskRowBase
          checked={isDone}
          title={task.name}
          onCheckedChange={onToggle}
          titleAriaLabel={task.name}
          titleSuffix={<TaskBadges workstreamName={task.workstreamName} className="hidden sm:inline lg:inline-flex lg:shrink-0 lg:leading-4" />}
          subtitle={organizationName ?? <div className="hidden sm:inline">{getTaskDescriptionSnippet(task)}</div>}
          meta={
            <>
              <TaskStatus status={task.status} />
              {task.startDate && (
                <span className="text-muted-foreground hidden sm:inline">
                  Start: {format(task.startDate, "dd/MM")}
                </span>
              )}
              {task.dueLabel && (
                <span className="text-muted-foreground hidden sm:inline">{task.dueLabel}</span>
              )}
              {task.priority && <TaskPriority priority={task.priority} className="hidden sm:inline" />}
              {task.tag && (
                <Badge variant="outline" className="whitespace-nowrap text-[11px] hidden sm:inline lg:inline-flex lg:leading-4">
                  {task.tag}
                </Badge>
              )}
              {task.assignee && (
                <Avatar className="size-6">
                  {task.assignee.avatarUrl && (
                    <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                  )}
                  <AvatarFallback>{task.assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              {canReorder ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 rounded-md text-muted-foreground cursor-grab active:cursor-grabbing"
                  aria-label="Reorder task"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  {...attributes}
                  {...listeners}
                >
                  <DotsSixVertical className="h-4 w-4" weight="regular" />
                </Button>
              ) : null}
            </>
          }
          className={isDragging ? "opacity-60" : ""}
        />
      </div>
    </div>
  )
}

export type ProjectTaskListViewProps = {
  flat?: boolean
  groups: ProjectTaskGroup[]
  onToggleTask: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
  onOpenTask?: (task: ProjectTask) => void
  canReorder?: boolean
}

export function ProjectTaskListView({
  flat = false,
  groups,
  onToggleTask,
  onAddTask,
  onOpenTask,
  canReorder = true,
}: ProjectTaskListViewProps) {
  if (flat) {
    const tasks = groups.flatMap((group) => group.tasks).sort((a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0) || a.name.localeCompare(b.name)
    )
    return <div role="list" aria-label="My tasks" className="divide-border divide-y">
      {tasks.map((task) => <div key={task.id} role="listitem">
        <TaskRowDnD task={task} canReorder={false}
          organizationName={task.organizationName ?? task.projectName}
          onToggle={() => onToggleTask(task.id)}
          onOpen={onOpenTask ? () => onOpenTask(task) : undefined} />
      </div>)}
    </div>
  }
  return (
    <>
      {groups.map((group) => (
        <ProjectTasksSection
          key={group.project.id}
          group={group}
          onToggleTask={onToggleTask}
          onAddTask={onAddTask}
          onOpenTask={onOpenTask}
          canReorder={canReorder}
        />
      ))}
    </>
  )
}
