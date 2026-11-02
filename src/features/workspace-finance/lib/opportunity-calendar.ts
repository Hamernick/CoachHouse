import type { RoadmapCalendarEvent } from "@/lib/roadmap/calendar"
import type { WorkspaceFinanceOpportunityInput } from "../types"
import { readOpportunityReport } from "./opportunity-report"

/** Read-only calendar projection. Date-only timelines keep their civil dates. */
export function opportunityCalendarEvents(items: WorkspaceFinanceOpportunityInput[], orgId: string, from?: string | null, to?: string | null): RoadmapCalendarEvent[] {
  return items.flatMap((item): RoadmapCalendarEvent[] => {
    if (item.status === "dismissed" || item.status === "not_awarded") return []
    const timeline = readOpportunityReport(item.report).timeline
    const due = item.dueAt && Number.isFinite(Date.parse(item.dueAt)) ? item.dueAt : null
    if (!timeline && !due) return []
    const startsAt = timeline ? `${timeline.from}T00:00:00` : due!
    const endsAt = timeline ? `${timeline.to}T23:59:59.999` : null
    // Civil ranges are compared as dates; timed deadlines compare UTC instants.
    if (timeline ? (from && timeline.to < from.slice(0, 10)) || (to && timeline.from > to.slice(0, 10)) : (from && Date.parse(startsAt) < Date.parse(from)) || (to && Date.parse(startsAt) > Date.parse(to))) return []
    return [{ id: `opportunity:${item.id}`, source: { kind: "workspace_opportunity", opportunityId: item.id, window: timeline, deadlineAt: due }, orgId,
      title: item.title, description: item.source ?? null, eventType: timeline ? "other" : "deadline", startsAt, endsAt, allDay: Boolean(timeline),
      recurrence: null, status: "active", assignedRoles: [], createdAt: item.discoveredAt ?? item.updatedAt ?? startsAt, updatedAt: item.updatedAt ?? startsAt }]
  })
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export function opportunityWindowIncludesDate(event: RoadmapCalendarEvent, date: Date) {
  if (event.source?.kind !== "workspace_opportunity" || !event.source.window) return false
  const day = localDay(date)
  return day >= event.source.window.from && day <= event.source.window.to
}
export function opportunityCalendarPresentation(event: RoadmapCalendarEvent, selectedDate?: Date) {
  if (event.source?.kind !== "workspace_opportunity") return null
  const window = event.source.window
  const deadline = event.source.deadlineAt ? new Date(event.source.deadlineAt) : null
  const isDeadline = Boolean(deadline && selectedDate && localDay(deadline) === localDay(selectedDate))
  const dates = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
  const range = window ? dates.formatRange(new Date(`${window.from}T00:00:00`), new Date(`${window.to}T00:00:00`)) : null
  return {
    isDeadline,
    label: isDeadline ? "Deadline" : window ? "Window" : "Deadline",
    detail: range ?? (deadline ? deadline.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""),
    description: range ? `Opportunity window: ${range}${deadline ? `. Deadline: ${deadline.toLocaleString()}` : ""}` : undefined,
  }
}
