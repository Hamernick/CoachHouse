import type { Particle } from "../types"

export type CalendarParticle = Extract<Particle, { type: "calendar" }>
export type CalendarEntry = CalendarParticle["data"]["entries"][number]
export type CalendarActivity = Pick<
  Extract<Particle, { type: "activity" }>,
  "id" | "title"
>

export const CALENDAR_CHANNELS: ReadonlyArray<{
  value: CalendarEntry["channels"][number]
  label: string
}> = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "Other" },
]
export const CALENDAR_STATUSES: ReadonlyArray<{
  value: CalendarEntry["status"]
  label: string
}> = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
]
export function createCalendarEntry(id: string, order: number): CalendarEntry {
  return {
    id,
    order,
    title: "New entry",
    channels: ["email"],
    contentType: "email",
    delivery: "manual",
    scheduledAt: null,
    publishedAt: null,
    content: "",
    cta: "",
    status: "draft",
  }
}
export function calendarPlanningOrder(entries: readonly CalendarEntry[]) {
  return [...entries].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id)
  )
}
export function calendarChronologicalOrder(entries: readonly CalendarEntry[]) {
  return [...entries].sort(
    (a, b) =>
      (a.scheduledAt ?? "z").localeCompare(b.scheduledAt ?? "z") ||
      a.order - b.order ||
      a.id.localeCompare(b.id)
  )
}
export function replaceCalendarEntry(
  particle: CalendarParticle,
  entry: CalendarEntry
): CalendarParticle {
  return {
    ...particle,
    data: {
      ...particle.data,
      entries: particle.data.entries.map((item) =>
        item.id === entry.id ? entry : item
      ),
    },
  }
}
export function moveCalendarEntry(
  particle: CalendarParticle,
  id: string,
  direction: -1 | 1
): CalendarParticle {
  const entries = calendarPlanningOrder(particle.data.entries)
  const index = entries.findIndex((entry) => entry.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= entries.length) return particle
  ;[entries[index], entries[target]] = [entries[target], entries[index]]
  return {
    ...particle,
    data: {
      ...particle.data,
      entries: entries.map((entry, order) => ({ ...entry, order })),
    },
  }
}
export function calendarLocalDateTime(instant: string | null) {
  if (!instant) return ""
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function calendarUtcDateTime(local: string): string | null | undefined {
  if (!local) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return undefined
  const date = new Date(local)
  // Reject nonexistent local times (including DST gaps), rather than shifting them.
  if (
    !Number.isFinite(date.getTime()) ||
    calendarLocalDateTime(date.toISOString()) !== local
  )
    return undefined
  return date.toISOString()
}
