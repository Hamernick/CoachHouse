import type { RoadmapCalendarEvent } from "@/lib/roadmap/calendar"
import type { ParticleGraph } from "../types"

/** The calendar is a read model of saved Events, never a second event store.
 * Hidden canvas cards remain scheduled. Undated Events remain drafts. */
export function workspaceParticleCalendarEvents(graph: ParticleGraph): RoadmapCalendarEvent[] {
  return graph.particles.flatMap((particle): RoadmapCalendarEvent[] => {
    const event = particle.type === "activity" ? particle.data.widget : undefined
    if (event?.kind !== "event" || !event.startsAt || (particle.type === "activity" && particle.data.source?.kind === "calendar_event")) return []
    const description = [
      particle.description,
      event.location ? `Place: ${event.location}` : null,
      event.attendees?.length ? `People: ${event.attendees.join(", ")}` : null,
    ].filter(Boolean).join("\n\n")
    return [{
      id: `particle:${particle.id}`, orgId: graph.workspaceId,
      source: { kind: "workspace_particle", particleId: particle.id },
      title: particle.title, description: description || null,
      eventType: "meeting", startsAt: event.startsAt, endsAt: null,
      allDay: false, recurrence: null, status: "active", assignedRoles: [],
      createdAt: particle.createdAt, updatedAt: particle.updatedAt,
    }]
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
}

export function particleCalendarChanged(before: ParticleGraph, after: ParticleGraph) {
  const content = (graph: ParticleGraph) => workspaceParticleCalendarEvents(graph)
    .map(({ id, title, description, startsAt }) => ({ id, title, description, startsAt }))
  return JSON.stringify(content(before)) !== JSON.stringify(content(after))
}

export function particleCalendarEventsInRange(events: RoadmapCalendarEvent[], from?: string | null, to?: string | null) {
  const lower = from ? Date.parse(from) : -Infinity
  const upper = to ? Date.parse(to) : Infinity
  return events.filter(event => {
    const start = Date.parse(event.startsAt)
    return start >= lower && start <= upper
  })
}
