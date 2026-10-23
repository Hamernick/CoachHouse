import { parseScheduleDay } from "./project-schedule"

export const TIMELINE_MODES = ["Day", "Week", "Month", "Quarter"] as const
export type TimelineMode = (typeof TIMELINE_MODES)[number]
export const DAY_MS = 86_400_000
export const timelineDays = { Day: 14, Week: 42, Month: 92, Quarter: 184 }
export const timelineCellWidth = { Day: 96, Week: 40, Month: 16, Quarter: 8 }
export function calendarDay(value: string) {
  const day = value ? parseScheduleDay(value) : null
  return day === null ? null : day * DAY_MS
}
export function dateOnly(value: Date | null) {
  return value && Number.isFinite(value.getTime())
    ? value.toISOString().slice(0, 10)
    : ""
}
export function shiftDay(value: string, days: number) {
  const time = calendarDay(value)
  return time === null
    ? ""
    : new Date(time + days * DAY_MS).toISOString().slice(0, 10)
}
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}
export function formatTimelineDay(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
) {
  const time = calendarDay(value)
  return time === null
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone: "UTC",
      }).format(time)
}
export function navigateTimeline(
  value: string,
  mode: TimelineMode,
  direction: number
) {
  if (mode === "Day" || mode === "Week")
    return shiftDay(value, direction * (mode === "Day" ? 7 : 28))
  const time = calendarDay(value)
  if (time === null) return value
  const date = new Date(time)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + direction * (mode === "Month" ? 1 : 3))
  return date.toISOString().slice(0, 10)
}
export function timelineGeometry(
  start: string,
  end: string,
  windowStart: string,
  days: number,
  cellWidth: number
) {
  const first = calendarDay(start || end),
    last = calendarDay(end || start),
    origin = calendarDay(windowStart)
  if (first === null || last === null || origin === null || last < first)
    return null
  const offset = (first - origin) / DAY_MS,
    finish = (last - origin) / DAY_MS + 1
  if (finish <= 0 || offset >= days)
    return { outside: true as const, date: start || end }
  return {
    outside: false as const,
    left: Math.max(0, offset) * cellWidth,
    width: (Math.min(days, finish) - Math.max(0, offset)) * cellWidth,
    clippedStart: offset < 0,
    clippedEnd: finish > days,
  }
}
