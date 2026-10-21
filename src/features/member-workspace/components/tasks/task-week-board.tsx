"use client"

import { useId, useState, type ReactNode } from "react"
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import { CalendarBlank, CaretLeft, CaretRight, DotsSixVertical, FolderSimple, Plus } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { MemberWorkspaceTaskItem } from "../../types"
import {
  addCalendarDays, formatCalendarDay, isTaskOverdue,
  partitionTaskBoard, weekStartForDay,
} from "../../lib/task-board"

export type TaskBoardCapabilities = { status: boolean; details: boolean; schedule: boolean }
export type TaskWeekBoardProps = {
  tasks: MemberWorkspaceTaskItem[]
  weekStart: string
  today: string
  showWeekend: boolean
  onWeekChange: (weekStart: string) => void
  onWeekendChange: (show: boolean) => void
  pendingTaskIds: ReadonlySet<string>
  capabilities: (task: MemberWorkspaceTaskItem) => TaskBoardCapabilities
  onToggleTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  onScheduleTask: (taskId: string, startDate: string) => Promise<boolean>
  onAddTask?: (context: { startDate: string; projectId?: string }) => void
  onShowList?: () => void
}

export function TaskWeekBoard(props: TaskWeekBoardProps) {
  const { tasks, showWeekend, onWeekChange, onWeekendChange, onAddTask } = props
  const monday = weekStartForDay(props.weekStart)
  const today = props.today
  const [dragging, setDragging] = useState<MemberWorkspaceTaskItem | null>(null)
  const board = partitionTaskBoard(tasks, monday, showWeekend, today)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const task = tasks.find((item) => item.id === active.id)
    const date = over?.data.current?.date
    if (!task || typeof date !== "string" || date === task.startDate) return
    if (props.pendingTaskIds.has(task.id) || !props.capabilities(task).schedule) return
    void props.onScheduleTask(task.id, date)
  }
  const renderTask = (task: MemberWorkspaceTaskItem) => (
    <TaskCard key={task.id} task={task} today={today} pending={props.pendingTaskIds.has(task.id)}
      capabilities={props.capabilities(task)} onToggle={props.onToggleTask}
      onOpen={props.onOpenTask} onSchedule={props.onScheduleTask} />
  )
  const add = (date: string) => {
    const projectIds = new Set(tasks.map((task) => task.projectId))
    onAddTask?.({ startDate: date, projectId: projectIds.size === 1 ? [...projectIds][0] : undefined })
  }

  return (
    <section aria-label="Weekly task board" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CalendarBlank className="size-4" aria-hidden />
          {formatCalendarDay(monday, { month: "short", day: "numeric" })} – {formatCalendarDay(addCalendarDays(monday, 6), { month: "short", day: "numeric", year: "numeric" })}
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="icon" className="size-11 shadow-none sm:size-8" aria-label="Previous week" onClick={() => onWeekChange(addCalendarDays(monday, -7))}><CaretLeft aria-hidden /></Button>
          <Button variant="outline" size="sm" className="min-h-11 shadow-none sm:min-h-8" onClick={() => onWeekChange(weekStartForDay(today))}>Today</Button>
          <Button variant="outline" size="icon" className="size-11 shadow-none sm:size-8" aria-label="Next week" onClick={() => onWeekChange(addCalendarDays(monday, 7))}><CaretRight aria-hidden /></Button>
          <Button variant="outline" size="sm" className="min-h-11 shadow-none sm:min-h-8" aria-pressed={showWeekend} onClick={() => onWeekendChange(!showWeekend)}>{showWeekend ? "Hide weekend" : `Show weekend${board.hiddenWeekend.length ? ` (${board.hiddenWeekend.length})` : ""}`}</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{tasks.length} matching tasks · {board.unscheduled.length} unscheduled · {board.outsideWeek.length} outside this week</span>
        {board.overdue.length > 0 && (props.onShowList ? (
          <Button variant="link" className="h-auto min-h-11 px-0 text-xs text-destructive sm:min-h-6" onClick={props.onShowList}>{board.overdue.length} overdue · View list</Button>
        ) : <span className="text-destructive">{board.overdue.length} overdue</span>)}
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}
        onDragStart={({ active }) => setDragging(tasks.find((task) => task.id === active.id) ?? null)}
        onDragCancel={() => setDragging(null)}>
        <div className="max-w-full overflow-x-auto pb-3" role="region" aria-label="Task schedule columns" tabIndex={0}>
          <div className="flex min-w-max items-stretch gap-3">
            <DayColumn date="" title="Unscheduled" tasks={board.unscheduled} onAdd={onAddTask ? () => add("") : undefined}>
              {board.unscheduled.map(renderTask)}
            </DayColumn>
            {board.days.map((day) => (
              <DayColumn key={day.date} date={day.date} title={formatCalendarDay(day.date, { day: "numeric", weekday: "short" })}
                current={day.date === today} tasks={day.tasks} onAdd={onAddTask ? () => add(day.date) : undefined}>
                {day.tasks.map(renderTask)}
              </DayColumn>
            ))}
          </div>
        </div>
        {board.outsideWeek.length > 0 && (
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">Outside this week ({board.outsideWeek.length})</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{board.outsideWeek.map(renderTask)}</div>
          </details>
        )}
        <DragOverlay dropAnimation={null}>
          {dragging && <div className="w-72 select-none rounded-2xl border bg-card p-3 shadow-md"><p className="break-words text-sm font-medium leading-5">{dragging.title}</p><p className="mt-2 truncate text-xs text-muted-foreground">{dragging.projectName}</p></div>}
        </DragOverlay>
      </DndContext>
    </section>
  )
}

function DayColumn({ date, title, current, tasks, onAdd, children }: {
  date: string; title: string; current?: boolean; tasks: MemberWorkspaceTaskItem[]
  onAdd?: () => void; children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date || "unscheduled"}`, data: { date } })
  return (
    <section ref={setNodeRef} aria-label={title} className={cn("flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-transparent bg-muted/40 p-2", current && "border-primary/60", isOver && "ring-2 ring-primary")}>
      <div className="flex min-h-11 items-center justify-between gap-2 px-1 sm:min-h-8">
        <h3 className={cn("text-sm font-medium", current && "text-primary")}>{title}</h3>
        <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <span aria-label={`${tasks.filter((task) => task.status === "done").length} completed of ${tasks.length} tasks`}>{tasks.filter((task) => task.status === "done").length}/{tasks.length}</span>
          {onAdd && <Button variant="ghost" size="icon" className="size-11 rounded-lg sm:size-7" onClick={onAdd} aria-label={`Add task to ${title}`}><Plus aria-hidden /></Button>}
        </div>
      </div>
      <div className="flex min-h-40 flex-col gap-2">{tasks.length ? children : <p className="px-2 py-4 text-xs text-muted-foreground">No tasks</p>}</div>
    </section>
  )
}

function TaskCard({ task, today, pending, capabilities, onToggle, onOpen, onSchedule }: {
  task: MemberWorkspaceTaskItem; today: string; pending: boolean; capabilities: TaskBoardCapabilities
  onToggle: TaskWeekBoardProps["onToggleTask"]; onOpen: TaskWeekBoardProps["onOpenTask"]
  onSchedule: TaskWeekBoardProps["onScheduleTask"]
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id, disabled: pending || !capabilities.schedule,
  })
  const done = task.status === "done"
  const overdue = isTaskOverdue(task, today)
  const organization = task.organizationName ?? task.projectClient ?? "Organization"
  const checkboxId = useId()
  return (
    <article ref={setNodeRef} inert={isDragging || undefined} aria-label={task.title} aria-busy={pending}
      className={cn("flex min-w-0 flex-col rounded-2xl border bg-card text-card-foreground", done && "opacity-70", isDragging && "select-none opacity-40 ring-2 ring-primary")}>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-start gap-1.5">
          <label htmlFor={checkboxId} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md has-[:disabled]:cursor-default sm:size-6">
            <Checkbox id={checkboxId} checked={done} disabled={pending || !capabilities.status} onCheckedChange={() => onToggle(task.id)} aria-label={`Mark ${task.title} as ${done ? "to do" : "done"}`} className="size-4 rounded-full data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600" />
          </label>
          {capabilities.details ? <Button variant="ghost" className={cn("h-auto min-h-11 min-w-0 flex-1 items-start justify-start whitespace-normal break-words rounded-md px-0 py-3 text-left leading-5 hover:bg-transparent hover:underline sm:min-h-6 sm:py-0.5", done && "text-muted-foreground line-through")} disabled={pending} onClick={() => onOpen(task.id)}>{task.title}</Button> : <p className={cn("min-w-0 flex-1 break-words py-3 text-sm font-medium leading-5 sm:py-0.5", done && "text-muted-foreground line-through")}>{task.title}</p>}
        </div>
        <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
          <FolderSimple className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <div className="grid min-w-0 gap-0.5">
            <p className="truncate" title={task.projectName}>{task.projectName}</p>
            <p className="truncate" title={organization}>{organization}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span>{task.status === "in-progress" ? "In progress" : task.status === "todo" ? "To do" : task.status === "waiting" ? "Waiting" : "Done"}</span>
            {task.tagLabel && <Badge variant="secondary" className="max-w-full rounded-md px-1.5 py-0 font-normal"><span className="truncate" title={task.tagLabel}>{task.tagLabel}</span></Badge>}
          </div>
          {pending ? <span role="status">Saving…</span> : task.assignee && <span className="max-w-24 truncate" title={`Assigned to ${task.assignee.name}`}>{task.assignee.name}</span>}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1 border-t px-2 py-1 text-xs text-muted-foreground">
        {capabilities.schedule ? <ScheduleControl task={task} pending={pending} onSchedule={onSchedule} /> : <span className="px-1">{task.startDate ? formatCalendarDay(task.startDate, { month: "short", day: "numeric" }) : "Unscheduled"}</span>}
        <div className="min-w-0 flex-1 text-right">
          {task.endDate && <span className={cn("whitespace-nowrap", overdue && "font-medium text-destructive")}>{overdue ? "Overdue" : "Due"} {formatCalendarDay(task.endDate, { month: "short", day: "numeric" })}</span>}
        </div>
        {capabilities.schedule && <Button ref={setActivatorNodeRef} variant="ghost" size="icon" className="size-11 shrink-0 touch-none cursor-grab rounded-md text-muted-foreground active:cursor-grabbing sm:size-7" disabled={pending} {...attributes} {...listeners} tabIndex={-1} aria-label={`Drag ${task.title} to another day`} title="Drag to another day"><DotsSixVertical className="size-4" aria-hidden /></Button>}
      </div>
    </article>
  )
}

function ScheduleControl({ task, pending, onSchedule }: {
  task: MemberWorkspaceTaskItem; pending: boolean; onSchedule: TaskWeekBoardProps["onScheduleTask"]
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(task.startDate)
  const id = useId()
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setDate(task.startDate) }}>
      <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-11 gap-1 rounded-md px-1.5 text-xs font-normal text-muted-foreground has-[>svg]:px-1.5 sm:h-7" disabled={pending} aria-label={`Schedule ${task.title}`}><CalendarBlank className="size-3.5" aria-hidden />{task.startDate ? formatCalendarDay(task.startDate, { month: "short", day: "numeric" }) : "Schedule"}</Button></PopoverTrigger>
      <PopoverContent className="w-64 motion-reduce:animate-none" align="start">
        <form className="grid gap-3" onSubmit={async (event) => { event.preventDefault(); if (!pending && date !== task.startDate && await onSchedule(task.id, date)) setOpen(false) }}>
          <FieldGroup>
            <Field className="gap-2">
              <FieldLabel htmlFor={id}>Start date</FieldLabel>
              <Input id={id} className="min-h-11 text-base sm:min-h-9 sm:text-sm" type="date" value={date} max={task.endDate || undefined} onChange={(event) => setDate(event.target.value)} disabled={pending} />
              <FieldDescription>Deadline stays unchanged. Clear the date to move to Unscheduled.</FieldDescription>
            </Field>
          </FieldGroup>
          <Button type="submit" size="sm" className="min-h-11 sm:min-h-9 w-full" disabled={pending || date === task.startDate}>Save date</Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
