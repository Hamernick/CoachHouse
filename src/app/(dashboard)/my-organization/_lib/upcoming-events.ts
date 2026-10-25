import {
  normalizeAssignedRoles,
  normalizeEventType,
  normalizeRecurrence,
} from "@/lib/roadmap/calendar"

import type { UpcomingEvent } from "./types"
import { readParticleGraph, workspaceParticleCalendarEvents } from "@/features/workspace-particles"
import { buildMyOrganizationCalendarView } from "./calendar"

export type UpcomingEventRow = {
  id: string
  title: string
  description: string | null
  event_type: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  recurrence: unknown | null
  status: string
  assigned_roles: string[] | null
  updated_at: string
}

export function mapUpcomingEvents(
  rows: UpcomingEventRow[] | null | undefined
): UpcomingEvent[] {
  if (!rows || rows.length === 0) return []
  return rows.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    event_type: normalizeEventType(event.event_type),
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    all_day: event.all_day,
    recurrence: normalizeRecurrence(event.recurrence),
    status: event.status === "canceled" ? "canceled" : "active",
    assigned_roles: normalizeAssignedRoles(event.assigned_roles ?? []),
    updated_at: event.updated_at,
  }))
}

/** Reuse the board already loaded for this page; no additional database read. */
export function mergeWorkspaceUpcomingEvents(existing: UpcomingEvent[], stored: unknown, orgId: string, now: string): UpcomingEvent[] {
  const graph = readParticleGraph(stored, orgId)
  if (!graph.ok) return existing
  const events: UpcomingEvent[] = workspaceParticleCalendarEvents(graph.value)
    .filter(event => Date.parse(event.startsAt) >= Date.parse(now))
    .map(event => ({
      id: event.id, source: event.source, title: event.title, description: event.description,
      event_type: event.eventType, starts_at: event.startsAt, ends_at: event.endsAt,
      all_day: event.allDay, recurrence: event.recurrence, status: event.status,
      assigned_roles: event.assignedRoles, updated_at: event.updatedAt,
    }))
  return [...existing, ...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)).slice(0, 5)
}

export function buildWorkspaceCalendarView({ stored, orgId, now, ...input }:
  Parameters<typeof buildMyOrganizationCalendarView>[0] & { stored: unknown; orgId: string; now: string }) {
  return buildMyOrganizationCalendarView({ ...input,
    upcomingEvents: mergeWorkspaceUpcomingEvents(input.upcomingEvents, stored, orgId, now) })
}
