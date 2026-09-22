const DAY_MS = 86_400_000

export function parseScheduleDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp / DAY_MS
    : null
}

export function getProjectSchedule(
  startDate: string,
  endDate: string,
  now = new Date()
) {
  const start = parseScheduleDay(startDate)
  const end = parseScheduleDay(endDate)
  if (start === null || end === null || end < start) return null
  // Date-only schedules follow the viewer's calendar, including DST boundaries.
  const today =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS
  const remaining = end - today
  const untilStart = start - today
  const days = Math.abs(remaining)
  return {
    progress:
      end === start
        ? today >= end
          ? 100
          : 0
        : Math.min(100, Math.max(0, ((today - start) / (end - start)) * 100)),
    status:
      untilStart > 0
        ? `Starts in ${untilStart} ${untilStart === 1 ? "day" : "days"}`
        : remaining === 0
          ? "Due today"
          : `${days} ${days === 1 ? "day" : "days"} ${remaining > 0 ? "left" : "overdue"}`,
    overdue: remaining < 0,
  }
}
