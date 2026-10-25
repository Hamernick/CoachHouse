import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { buildParticlePreset, DEFAULT_PRESET_FIELDS, PARTICLE_PRESETS } from "@/features/workspace-particles/lib/particle-presets"
import { workspaceParticleCalendarEvents, particleCalendarChanged, particleCalendarEventsInRange } from "@/features/workspace-particles/lib/particle-event-calendar"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { createParticleHistory } from "@/features/workspace-particles/lib/particle-history"
import { calendarParticleHref, calendarParticleId } from "@/lib/roadmap/calendar-particle-link"
import { RoadmapCalendarAgendaRow } from "@/components/roadmap/roadmap-calendar/components/roadmap-calendar-month-agenda-panel-parts"
import { readWorkspaceParticleCalendar } from "@/server/workspace-particle-calendar"
import { mergeWorkspaceUpcomingEvents } from "@/app/(dashboard)/my-organization/_lib/upcoming-events"
import { batch, graph, particle, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"
import { createSupabaseServerClientServerMock } from "./test-utils"

const mocks = vi.hoisted(() => ({ access: vi.fn() }))
vi.mock("@/actions/roadmap-calendar-helpers", async importOriginal => ({
  ...await importOriginal<typeof import("@/actions/roadmap-calendar-helpers")>(),
  resolveCalendarAccess: mocks.access,
}))
import { listRoadmapCalendarEvents, updateRoadmapCalendarEvent, deleteRoadmapCalendarEvent } from "@/actions/roadmap-calendar"

function event() {
  const preset = PARTICLE_PRESETS.find(item => item.id === "event")
  if (!preset) throw new Error("Missing Event preset")
  return buildParticlePreset(preset, {
    id: ID(30), workspaceId: WORKSPACE, now: NOW, title: "Dinner", description: "Bring ideas",
    fields: { ...DEFAULT_PRESET_FIELDS, when: "2026-10-16T20:00", location: "Community table", guests: "Priya" },
  })
}

describe("Event calendar read model", () => {
  it("projects the saved identity, UTC instant and details, without inventing invitations or duration", () => {
    const events = workspaceParticleCalendarEvents(graph([event(), particle(4)]))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: `particle:${ID(30)}`, orgId: WORKSPACE,
      source: { kind: "workspace_particle", particleId: ID(30) }, title: "Dinner",
      startsAt: new Date("2026-10-16T20:00").toISOString(), endsAt: null, assignedRoles: [],
      description: "Bring ideas\n\nPlace: Community table\n\nPeople: Priya" })
  })

  it("keeps hidden Events scheduled and ignores movement, resizing and save timestamps", () => {
    const saved = event()
    const changed = { ...saved, canvasHidden: true, position: { x: 1000, y: 300 }, updatedAt: "2026-10-14T20:00:00Z" }
    expect(workspaceParticleCalendarEvents(graph([changed]))).toHaveLength(1)
    expect(particleCalendarChanged(graph([saved]), graph([changed]))).toBe(false)
  })

  it("excludes undated Events and Activities already backed by a real calendar row", () => {
    const saved = event()
    if (saved.type !== "activity" || saved.data.widget?.kind !== "event") throw new Error("Wrong fixture")
    const undated = { ...saved, data: { ...saved.data, widget: { ...saved.data.widget, startsAt: null } } }
    const linked = { ...saved, data: { ...saved.data, source: { kind: "calendar_event" as const, id: ID(99) } } }
    expect(workspaceParticleCalendarEvents(graph([undated, linked]))).toEqual([])
  })

  it("detects creation, deletion, unscheduling and edits to every displayed detail", () => {
    const saved = event()
    if (saved.type !== "activity" || saved.data.widget?.kind !== "event") throw new Error("Wrong fixture")
    const before = graph([saved])
    expect(particleCalendarChanged(graph([]), before)).toBe(true)
    expect(particleCalendarChanged(before, graph([]))).toBe(true)
    for (const change of [{ startsAt: null }, { startsAt: "2026-11-01T12:00:00Z" }, { location: "New place" }, { attendees: ["Sam"] }])
      expect(particleCalendarChanged(before, graph([{ ...saved, data: { ...saved.data, widget: { ...saved.data.widget, ...change } } }]))).toBe(true)
    expect(particleCalendarChanged(before, graph([{ ...saved, title: "Lunch" }]))).toBe(true)
    expect(particleCalendarChanged(before, graph([{ ...saved, description: "New details" }]))).toBe(true)
  })

  it("filters exact UTC boundaries and merges existing upcoming rows without another read", () => {
    const saved = graph([event()])
    const events = workspaceParticleCalendarEvents(saved)
    expect(particleCalendarEventsInRange(events, events[0].startsAt, events[0].startsAt)).toHaveLength(1)
    expect(particleCalendarEventsInRange(events, "2026-11-01T00:00:00Z")).toEqual([])
    expect(mergeWorkspaceUpcomingEvents([], saved, WORKSPACE, NOW)[0]).toMatchObject({ id: events[0].id, source: events[0].source })
    expect(mergeWorkspaceUpcomingEvents([], saved, WORKSPACE, "2027-01-01T00:00:00Z")).toEqual([])
    expect(mergeWorkspaceUpcomingEvents([], saved, ID(9999), NOW)).toEqual([])
  })

  it("uses the same receipt across retries and removes/restores the calendar entry through Undo/Redo", async () => {
    let current = graph([])
    const history = createParticleHistory(WORKSPACE)
    history.observe(current)
    const request = batch(101, [{ kind: "put_particle", particle: event(), expectedRevision: null }])
    const result = await applyParticleBatch(current, request, NOW)
    if (!result.ok) throw new Error(result.error)
    history.committed(request, result.value)
    current = result.value.graph
    const replay = await applyParticleBatch(current, request, NOW)
    expect(replay.ok && workspaceParticleCalendarEvents(replay.value.graph)).toHaveLength(1)
    for (const [direction, count] of [["undo", 0], ["redo", 1]] as const) {
      const travel = history.prepare(direction, current, ID(direction === "undo" ? 102 : 103))
      if (!travel) throw new Error("Missing history operation")
      const committed = await applyParticleBatch(current, travel, NOW)
      if (!committed.ok) throw new Error(committed.error)
      history.committed(travel, committed.value, direction)
      current = committed.value.graph
      expect(workspaceParticleCalendarEvents(current)).toHaveLength(count)
    }
  })

  it("offers a real Particle target even for calendar viewers, without a fake calendar edit action", () => {
    const projected = workspaceParticleCalendarEvents(graph([event()]))[0]
    const html = renderToStaticMarkup(createElement(RoadmapCalendarAgendaRow, {
      event: projected, canManageCalendar: false, formatTimeRange: () => "8 PM", onEditEvent: vi.fn(),
    }))
    expect(html).toContain('aria-label="Open Dinner on canvas"')
    expect(calendarParticleHref(ID(30))).toBe(`/workspace?particle=${ID(30)}`)
    expect(calendarParticleId('" onclick="bad')).toBeNull()
    expect(() => calendarParticleHref("bad")).toThrow()
  })
})

describe("authorized calendar reads", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ orgId: WORKSPACE, canManageCalendar: true }) })
  function client() {
    const boardRead = vi.fn().mockResolvedValue({ data: { state: { particleGraph: graph([event()]) } }, error: null })
    const board = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: boardRead }
    const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) }
    const sdk = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ID(888) } }, error: null }) },
      from: vi.fn((name: string) => name === "organization_workspace_boards" ? board : table) }
    createSupabaseServerClientServerMock.mockResolvedValue(sdk)
    return { sdk, board, boardRead }
  }

  it("scopes the read to the authorized organization and lists Event particles internally", async () => {
    const f = client()
    const result = await listRoadmapCalendarEvents({ calendarType: "internal" })
    expect(result).toMatchObject({ ok: true, orgId: WORKSPACE, events: [{ id: `particle:${ID(30)}` }] })
    expect(f.board.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(f.boardRead).toHaveBeenCalledOnce()
  })

  it("never projects private workspace Events into public calendars or signed-out requests", async () => {
    const f = client()
    expect(await listRoadmapCalendarEvents({ calendarType: "public" })).toMatchObject({ ok: true, events: [] })
    expect(f.boardRead).not.toHaveBeenCalled()
    f.sdk.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null } as never)
    expect(await listRoadmapCalendarEvents({ calendarType: "internal" })).toEqual({ error: "Not authenticated." })
    expect(f.boardRead).not.toHaveBeenCalled()
  })

  it("does not hide storage or unsupported graph errors as an empty successful calendar", async () => {
    const f = client()
    f.boardRead.mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } })
    expect(await listRoadmapCalendarEvents({ calendarType: "internal" })).toHaveProperty("error")
    f.boardRead.mockResolvedValueOnce({ data: { state: { particleGraph: { schemaVersion: 99 } } }, error: null })
    await expect(readWorkspaceParticleCalendar(f.sdk as never, WORKSPACE)).rejects.toThrow()
  })

  it("refuses calendar row writes for projected Particle identities", async () => {
    expect(await updateRoadmapCalendarEvent({ calendarType: "internal", eventId: `particle:${ID(30)}`, updates: { title: "Wrong writer" } })).toHaveProperty("error")
    expect(await deleteRoadmapCalendarEvent({ calendarType: "internal", eventId: `particle:${ID(30)}` })).toHaveProperty("error")
  })
})
