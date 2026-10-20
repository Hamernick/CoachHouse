import type { MemberWorkspaceTaskItem } from "../types"

/** A task date is a calendar day, never a timestamp converted to local time. */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function calendarDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function addCalendarDays(day: string, days: number): string {
  if (!isCalendarDay(day)) throw new Error("Invalid calendar day")
  const date = new Date(`${day}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekStartForDay(day: string): string {
  if (!isCalendarDay(day)) throw new Error("Invalid calendar day")
  const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay()
  return addCalendarDays(day, -((weekday + 6) % 7))
}

export function formatCalendarDay(day: string, options: Intl.DateTimeFormatOptions): string {
  if (!isCalendarDay(day)) return "No date"
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00.000Z`))
}

export function isTaskOverdue(task: MemberWorkspaceTaskItem, today: string): boolean {
  return task.status !== "done" && isCalendarDay(task.endDate) && task.endDate < today
}

export function partitionTaskBoard(
  tasks: MemberWorkspaceTaskItem[],
  weekStart: string,
  showWeekend: boolean,
  today: string,
) {
  const monday = weekStartForDay(weekStart)
  const end = addCalendarDays(monday, 6)
  const days = Array.from({ length: showWeekend ? 7 : 5 }, (_, offset) => ({
    date: addCalendarDays(monday, offset),
    tasks: [] as MemberWorkspaceTaskItem[],
  }))
  const columns = new Map(days.map((day) => [day.date, day]))
  const unscheduled: MemberWorkspaceTaskItem[] = []
  const outsideWeek: MemberWorkspaceTaskItem[] = []
  const hiddenWeekend: MemberWorkspaceTaskItem[] = []
  const overdue: MemberWorkspaceTaskItem[] = []
  // Preserve server-provided project/manual ordering within each partition.
  for (const task of tasks) {
    if (isTaskOverdue(task, today)) overdue.push(task)
    if (!isCalendarDay(task.startDate)) unscheduled.push(task)
    else if (task.startDate < monday || task.startDate > end) outsideWeek.push(task)
    else {
      const column = columns.get(task.startDate)
      if (column) column.tasks.push(task)
      else hiddenWeekend.push(task)
    }
  }
  return { days, unscheduled, outsideWeek, hiddenWeekend, overdue }
}
