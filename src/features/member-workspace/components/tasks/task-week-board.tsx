"use client"

import { useId, useState, type ReactNode } from "react"
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import { CalendarBlank, CaretLeft, CaretRight, DotsSixVertical, Plus } from "@phosphor-icons/react/dist/ssr"
import { Button, Input } from "@/features/platform-admin-dashboard"
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
    <section aria-label="Weekly task board" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CalendarBlank className="size-4" aria-hidden />
          {formatCalendarDay(monday, { month: "short", day: "numeric" })} – {formatCalendarDay(addCalendarDays(monday, 6), { month: "short", day: "numeric", year: "numeric" })}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Previous week" onClick={() => onWeekChange(addCalendarDays(monday, -7))}><CaretLeft aria-hidden /></Button>
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => onWeekChange(weekStartForDay(today))}>Today</Button>
          <Button variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Next week" onClick={() => onWeekChange(addCalendarDays(monday, 7))}><CaretRight aria-hidden /></Button>
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" aria-pressed={showWeekend} onClick={() => onWeekendChange(!showWeekend)}>{showWeekend ? "Hide weekend" : `Show weekend${board.hiddenWeekend.length ? ` (${board.hiddenWeekend.length})` : ""}`}</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{tasks.length} matching tasks · {board.unscheduled.length} unscheduled · {board.outsideWeek.length} outside this week</span>
        {board.overdue.length > 0 && (props.onShowList ? (
          <Button variant="link" className="h-auto min-h-11 sm:min-h-9 px-0 text-xs text-destructive" onClick={props.onShowList}>{board.overdue.length} overdue · View list</Button>
        ) : <span className="text-destructive">{board.overdue.length} overdue</span>)}
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}
        onDragStart={({ active }) => setDragging(tasks.find((task) => task.id === active.id) ?? null)}
        onDragCancel={() => setDragging(null)}>
        <div className="max-w-full overflow-x-auto pb-3" role="region" aria-label="Task schedule columns" tabIndex={0}>
          <div className="flex min-w-max items-start gap-3">
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
          {dragging && <div className="w-72 select-none rounded-2xl border bg-card p-4 shadow-md"><p className="mb-2 truncate text-xs text-muted-foreground">{dragging.projectName}</p><p className="text-sm font-medium">{dragging.title}</p></div>}
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
    <section ref={setNodeRef} aria-label={title} className={cn("w-72 shrink-0 space-y-3 rounded-2xl border border-muted bg-muted/70 p-3", current && "border-primary/60", isOver && "ring-2 ring-primary")}>
      <div className="flex min-h-11 sm:min-h-9 items-center justify-between gap-2">
        <h3 className={cn("text-xs font-semibold uppercase tracking-wide", current && "text-primary")}>{title}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span aria-label={`${tasks.filter((task) => task.status === "done").length} completed of ${tasks.length} tasks`}>{tasks.filter((task) => task.status === "done").length}/{tasks.length}</span>
          {onAdd && <Button variant="ghost" size="icon" className="size-11 rounded-full sm:size-9" onClick={onAdd} aria-label={`Add task to ${title}`}><Plus aria-hidden /></Button>}
        </div>
      </div>
      <div className="min-h-32 space-y-3">{tasks.length ? children : <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No tasks</p>}</div>
      {onAdd && <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9 w-full justify-start" onClick={onAdd}><Plus aria-hidden />Add task</Button>}
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
  const checkboxId = useId()
  return (
    <article ref={setNodeRef} inert={isDragging || undefined} aria-label={task.title} aria-busy={pending} className={cn("space-y-3 rounded-2xl border bg-card p-3", done && "opacity-70", isDragging && "select-none opacity-40 ring-2 ring-primary")}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={`${task.projectName} · ${task.organizationName ?? task.projectClient ?? "Organization"}`}>{task.projectName} · {task.organizationName ?? task.projectClient ?? "Organization"}</p>
        {capabilities.schedule && <Button ref={setActivatorNodeRef} variant="ghost" size="icon" className="size-11 shrink-0 cursor-grab touch-none sm:size-9" disabled={pending} {...attributes} {...listeners} tabIndex={-1} aria-label={`Drag ${task.title} to another day`}><DotsSixVertical aria-hidden /></Button>}
      </div>
      <div className="flex items-start gap-2">
        <label htmlFor={checkboxId} className="flex size-11 shrink-0 items-center justify-center">
          <Checkbox id={checkboxId} checked={done} disabled={pending || !capabilities.status} onCheckedChange={() => onToggle(task.id)} aria-label={`Mark ${task.title} as ${done ? "to do" : "done"}`} className="size-5 rounded-full data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600" />
        </label>
        {capabilities.details ? <Button variant="ghost" className={cn("h-auto min-h-11 sm:min-h-9 min-w-0 flex-1 justify-start whitespace-normal px-0 text-left leading-5 hover:bg-transparent", done && "text-muted-foreground line-through")} disabled={pending} onClick={() => onOpen(task.id)}>{task.title}</Button> : <p className={cn("min-w-0 py-2 text-sm leading-5", done && "text-muted-foreground line-through")}>{task.title}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{task.status === "in-progress" ? "In progress" : task.status === "todo" ? "To do" : task.status === "waiting" ? "Waiting" : "Done"}</span>
        {task.tagLabel && <span className="rounded-md border px-1.5 py-0.5">{task.tagLabel}</span>}
        {task.assignee && <span title={task.assignee.name}>{task.assignee.name}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {capabilities.schedule ? <ScheduleControl task={task} pending={pending} onSchedule={onSchedule} /> : <span>{task.startDate ? formatCalendarDay(task.startDate, { month: "short", day: "numeric" }) : "Unscheduled"}</span>}
        {task.endDate && <span className={cn(isTaskOverdue(task, today) && "font-medium text-destructive")}>{isTaskOverdue(task, today) ? "Overdue" : "Due"} {formatCalendarDay(task.endDate, { month: "short", day: "numeric" })}</span>}
        {pending && <span role="status">Saving…</span>}
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
      <PopoverTrigger asChild><Button variant="outline" size="sm" className="min-h-11 sm:min-h-9 gap-1 px-2 text-xs" disabled={pending} aria-label={`Schedule ${task.title}`}><CalendarBlank aria-hidden />{task.startDate ? formatCalendarDay(task.startDate, { month: "short", day: "numeric" }) : "Schedule"}</Button></PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 motion-reduce:animate-none" align="start">
        <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); if (!pending && date !== task.startDate && await onSchedule(task.id, date)) setOpen(false) }}>
          <label htmlFor={id} className="text-sm font-medium">Start date</label>
          <Input id={id} className="min-h-11 sm:min-h-9" type="date" value={date} max={task.endDate || undefined} onChange={(event) => setDate(event.target.value)} disabled={pending} />
          <p className="text-xs text-muted-foreground">Deadline stays unchanged. Clear the date to move to Unscheduled.</p>
          <Button type="submit" size="sm" className="min-h-11 sm:min-h-9 w-full" disabled={pending || date === task.startDate}>Save date</Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
