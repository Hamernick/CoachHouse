"use client"

import Link from "next/link"
import { ArrowDown, ArrowUp, CaretDown, FolderSimple, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr"
import { Button, ProgressCircle, TaskRowBase } from "@/features/platform-admin-dashboard"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatCalendarDay } from "../../lib/task-board"
import type { MemberWorkspaceTaskGroup, MemberWorkspaceTaskItem } from "../../types"

type TaskCapabilities = { status: boolean; details: boolean; schedule: boolean; order: boolean }

export type TaskProjectListProps = {
  groups: MemberWorkspaceTaskGroup[]
  pendingTaskIds: ReadonlySet<string>
  capabilities: (task: MemberWorkspaceTaskItem) => TaskCapabilities
  onToggleTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  onAddTask?: (context: { projectId: string; workstreamName?: string }) => void
  canAddTask?: (projectId: string) => boolean
  onMoveTask?: (taskId: string, neighborTaskId: string, placement: "before" | "after") => void
}

const STATUS_LABELS = { todo: "To do", "in-progress": "In progress", waiting: "Waiting", done: "Done" }

function TaskListRow({ task, previous, next, ...props }: Omit<TaskProjectListProps, "groups"> & {
  task: MemberWorkspaceTaskItem
  previous?: MemberWorkspaceTaskItem
  next?: MemberWorkspaceTaskItem
}) {
  const capability = props.capabilities(task)
  const pending = props.pendingTaskIds.has(task.id)
  return (
    <li aria-busy={pending}>
      <TaskRowBase
        checked={task.status === "done"}
        disabled={pending || !capability.status}
        title={task.title}
        className="max-sm:grid max-sm:grid-cols-[1rem_minmax(0,1fr)] max-sm:items-start max-sm:gap-y-1 [&>div:last-child]:max-sm:col-start-2 [&>div:last-child]:max-sm:ml-0 [&>div:last-child]:max-sm:justify-between [&>div:nth-child(2)>div:first-child>span]:max-sm:whitespace-normal [&>div:nth-child(2)>div:first-child>span]:max-sm:max-w-none [&>div:nth-child(2)>div:first-child>span]:max-sm:break-words [&>div:nth-child(2)>div:nth-child(2)]:max-sm:whitespace-normal min-h-11 [&_[role=checkbox]]:relative [&_[role=checkbox]]:after:absolute [&_[role=checkbox]]:after:-inset-3.5 [&_[role=checkbox]]:after:content-['']"
        titleAriaLabel={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
        onCheckedChange={() => props.onToggleTask(task.id)}
        subtitle={[
          task.workstreamName,
          task.endDate ? `Due ${formatCalendarDay(task.endDate, { month: "short", day: "numeric", year: "numeric" })}` : undefined,
          task.assignee?.name,
        ].filter(Boolean).join(" · ") || undefined}
        titleSuffix={capability.details ? (
          <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" disabled={pending} aria-label={`Edit ${task.title}`} onClick={() => props.onOpenTask(task.id)}>
            <PencilSimple className="size-4" />
          </Button>
        ) : undefined}
        meta={
          <>
            <span>{STATUS_LABELS[task.status]}</span>
            {task.priority && task.priority !== "no-priority" ? <span className="hidden rounded-full bg-muted px-2 py-0.5 capitalize lg:inline">{task.priority}</span> : null}
            {task.tagLabel ? <span className="hidden max-w-28 truncate rounded-full border px-2 py-0.5 lg:inline">{task.tagLabel}</span> : null}
            {capability.order && props.onMoveTask ? (
              <span className="flex items-center">
                <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Move ${task.title} up`} disabled={pending || !previous || props.pendingTaskIds.has(previous.id) || !props.capabilities(previous).order} onClick={() => previous && props.onMoveTask?.(task.id, previous.id, "before")}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Move ${task.title} down`} disabled={pending || !next || props.pendingTaskIds.has(next.id) || !props.capabilities(next).order} onClick={() => next && props.onMoveTask?.(task.id, next.id, "after")}>
                  <ArrowDown className="size-4" />
                </Button>
              </span>
            ) : null}
          </>
        }
      />
    </li>
  )
}

export function TaskProjectList({ groups, ...props }: TaskProjectListProps) {
  return <div className="space-y-4">
    {groups.map((group) => {
      const done = group.tasks.filter((task) => task.status === "done").length
      const total = group.tasks.length
      const organizations = [...new Set(group.tasks.map((task) => task.organizationName ?? task.projectClient).filter(Boolean))]
      return (
        <Collapsible key={group.projectId} defaultOpen className="mx-auto max-w-6xl space-y-2 rounded-3xl border border-border bg-muted p-3 shadow-[var(--shadow-workstream)]">
          <header className="flex items-center gap-3 py-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-11 shrink-0 group sm:size-8" aria-label={`Toggle ${group.projectName} tasks`}>
                <CaretDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90 motion-reduce:transition-none" />
              </Button>
            </CollapsibleTrigger>
            <FolderSimple className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
            <div className="min-w-0 flex-1">
              <Link href={`/projects/${group.projectId}`} className="block truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{group.projectName}</Link>
              {organizations.length ? <p className="truncate text-xs text-muted-foreground">{organizations.join(" · ")}</p> : null}
            </div>
            <span className="text-xs text-muted-foreground" aria-label={`${done} of ${total} visible tasks completed`}>{done}/{total}</span>
            <ProgressCircle progress={total ? Math.round(done / total * 100) : 0} color="var(--chart-2)" size={18} />
            {props.onAddTask && (!props.canAddTask || props.canAddTask(group.projectId)) ? (
              <Button variant="ghost" size="icon-sm" className="size-11 rounded-full sm:size-8" aria-label={`Add task to ${group.projectName}`} onClick={() => props.onAddTask?.({ projectId: group.projectId })}>
                <Plus className="size-4" />
              </Button>
            ) : null}
          </header>
          <CollapsibleContent>
            <ul aria-label={`${group.projectName} tasks`} className="space-y-1 rounded-2xl border border-border bg-background px-1 py-2 sm:px-2">
              {group.tasks.map((task, index) => <TaskListRow key={task.id} task={task} previous={group.tasks[index - 1]} next={group.tasks[index + 1]} {...props} />)}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )
    })}
  </div>
}
