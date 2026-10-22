import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ports = vi.hoisted(() => ({
  broker: vi.fn(), direct: vi.fn(), useBroker: false,
  env: { GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS: undefined as string | undefined, GOOGLE_COACHING_PAULA_BLOCKING_CALENDAR_IDS: undefined as string | undefined },
}))
vi.mock("@/lib/env", () => ({ env: ports.env }))
vi.mock("@/features/coaching-booking/server/google-calendar", () => ({
  isBrokerConfigured: () => ports.useBroker,
  getCoachCalendarId: (coachId: string) => `${coachId}@example.org`,
  requestGoogleCalendarDirect: ports.direct,
  requestGoogleCalendarBroker: ports.broker,
}))
import { assertCoachingCalendarAvailable, CoachingCalendarConflictError, listGoogleBusyWindows } from "@/features/coaching-booking/server/calendar-conflicts"
import { updateGoogleCoachingEventTitle } from "@/features/coaching-booking/server/calendar-event-titles"
import { eventBusyWindow, listBlockingEventWindows, readCompleteFreeBusy } from "../../src/cloud-run/coaching-calendar-broker/calendar-availability.mjs"
import { freeBusy, updateEventTitle } from "../../src/cloud-run/coaching-calendar-broker/server.mjs"

const timeMin = "2026-10-23T15:00:00Z"
const timeMax = "2026-10-23T15:45:00Z"
const interval = { start: timeMin, end: timeMax }
const window = { startsAt: timeMin, endsAt: timeMax }
const self = { id: "own-id", etag: '"v1"', iCalUID: "own@google.com", organizer: { email: "joel@example.org", self: true }, start: { dateTime: timeMin }, end: { dateTime: timeMax } }
const identity = { id: self.id, iCalUID: self.iCalUID, organizerEmail: self.organizer.email }

beforeEach(() => {
  ports.direct.mockReset()
  ports.broker.mockReset()
  ports.useBroker = false
  ports.env.GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS = undefined
  ports.env.GOOGLE_COACHING_PAULA_BLOCKING_CALENDAR_IDS = undefined
  vi.stubEnv("GOOGLE_COACHING_JOEL_CALENDAR_ID", "joel@example.org")
  vi.stubEnv("GOOGLE_COACHING_PAULA_CALENDAR_ID", "paula@example.org")
})
afterEach(() => vi.unstubAllEnvs())

describe("complete calendar availability", () => {
  it.each([
    {}, { calendars: {} }, { calendars: { primary: { errors: [{ reason: "notFound" }], busy: [] } } },
    { calendars: { primary: {} } }, { calendars: { primary: { busy: [{ start: "invalid", end: timeMax }] } } },
  ])("fails closed for missing or invalid freeBusy data: %j", (response) => {
    expect(() => readCompleteFreeBusy(response, ["primary"])).toThrow()
  })

  it("requires each additional blocking calendar and includes its conflicts", async () => {
    ports.env.GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS = "secondary@example.org,joel@example.org"
    ports.direct.mockResolvedValue({ calendars: { "joel@example.org": { busy: [] }, "secondary@example.org": { busy: [interval] } } })
    expect(await listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax })).toEqual([window])
    expect(ports.direct).toHaveBeenCalledWith(expect.objectContaining({ body: { timeMin, timeMax, items: [{ id: "joel@example.org" }, { id: "secondary@example.org" }] } }))
    ports.direct.mockResolvedValue({ calendars: { "joel@example.org": { busy: [] } } })
    await expect(listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax })).rejects.toThrow()
  })

  it("checks both coaches and distinguishes a definite conflict", async () => {
    ports.direct.mockImplementation(async ({ coachId }: { coachId: string }) => ({ calendars: { [`${coachId}@example.org`]: { busy: coachId === "paula" ? [interval] : [] } } }))
    await expect(assertCoachingCalendarAvailable({ startsAt: timeMin, endsAt: timeMax })).rejects.toBeInstanceOf(CoachingCalendarConflictError)
    expect(ports.direct).toHaveBeenCalledTimes(2)
  })

  it("rejects an old or malformed broker response", async () => {
    ports.useBroker = true
    ports.broker.mockResolvedValue({ busy: [] })
    await expect(listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax })).rejects.toThrow("temporarily unavailable")
    ports.broker.mockResolvedValue({ availabilityVersion: 2 })
    await expect(listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax })).rejects.toThrow("incomplete")
    ports.broker.mockResolvedValue({ availabilityVersion: 2, busy: [] })
    await expect(listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax })).resolves.toEqual([])
  })

  it("broker fails closed on omitted calendar entries", async () => {
    await expect(freeBusy({ coachId: "joel", timeMin, timeMax }, async () => ({ calendars: {} }))).rejects.toThrow()
  })
})

describe("exact own-event exclusion", () => {
  it("keeps unrelated events at identical times while excluding attendee copies by iCalUID and organizer", () => {
    const options = { timeMin, timeMax, identity }
    expect(eventBusyWindow({ ...self, id: "attendee-copy-id" }, options)).toBeNull()
    expect(eventBusyWindow({ ...self, iCalUID: "unrelated@google.com" }, options)).toEqual(window)
    expect(eventBusyWindow({ ...self, organizer: { email: "other@example.org" } }, options)).toEqual(window)
    expect(eventBusyWindow({ ...self, recurringEventId: "another-series" }, options)).toEqual(window)
  })

  it("reads all pages and keeps a second conflict beyond the own event", async () => {
    const request = vi.fn().mockResolvedValueOnce({ items: [self], nextPageToken: "next" }).mockResolvedValueOnce({ items: [{ ...self, id: "other", iCalUID: "other" }] })
    expect(await listBlockingEventWindows({ request, calendarIds: ["paula@example.org"], coachId: "paula", timeMin, timeMax, identity })).toEqual([window])
    expect(request.mock.calls[1][0].path).toContain("pageToken=next")
  })

  it("blocks incomplete pagination and insufficient event visibility", async () => {
    const input = { calendarIds: ["joel@example.org"], coachId: "joel", timeMin, timeMax, identity }
    await expect(listBlockingEventWindows({ ...input, request: async () => ({ items: [self], nextPageToken: "repeated" }) })).rejects.toThrow("incomplete")
    await expect(listBlockingEventWindows({ ...input, request: async () => ({ items: [], accessRole: "freeBusyReader" }) })).rejects.toThrow("inspect")
  })

  it("honors transparency, declines, cancellation and all-day overlap without UTC conversion", () => {
    const options = { timeMin, timeMax, identity: undefined }
    expect(eventBusyWindow({ ...self, transparency: "transparent" }, options)).toBeNull()
    expect(eventBusyWindow({ ...self, status: "cancelled" }, options)).toBeNull()
    expect(eventBusyWindow({ ...self, attendees: [{ self: true, responseStatus: "declined" }] }, options)).toBeNull()
    expect(eventBusyWindow({ ...self, start: { date: "2026-10-24" }, end: { date: "2026-10-25" } }, options)).toEqual(window)
    expect(eventBusyWindow({ ...self, start: { dateTime: timeMax }, end: { dateTime: "2026-10-23T16:00:00Z" } }, options)).toBeNull()
  })

  it("direct adapter obtains organizer identity before excluding only its attendee copy", async () => {
    ports.direct.mockResolvedValueOnce(self).mockResolvedValueOnce({ items: [{ ...self, id: "copy-id" }, { ...self, id: "other", iCalUID: "other" }] })
    expect(await listGoogleBusyWindows({ coachId: "paula", timeMin, timeMax, excludeGoogleEventId: self.id })).toEqual([window])
    expect(ports.direct.mock.calls[0][0]).toMatchObject({ coachId: "joel" })
    expect(ports.direct.mock.calls[1][0]).toMatchObject({ coachId: "paula" })
  })

  it("a missing own event uses complete freeBusy instead of hiding other conflicts", async () => {
    ports.direct.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 })).mockResolvedValueOnce({ calendars: { "joel@example.org": { busy: [interval] } } })
    await expect(listGoogleBusyWindows({ coachId: "joel", timeMin, timeMax, excludeGoogleEventId: self.id })).resolves.toEqual([window])
  })

  it("broker follows the same identity and overlap rules", async () => {
    const request = vi.fn().mockResolvedValueOnce(self).mockResolvedValueOnce({ items: [{ ...self, id: "copy" }, { ...self, iCalUID: "unrelated" }] })
    expect(await freeBusy({ coachId: "paula", timeMin, timeMax, excludeGoogleEventId: self.id }, request)).toEqual({ availabilityVersion: 2, busy: [window] })
  })
})

describe("title-only provider updates", () => {
  it("direct adapter PATCHes only summary with If-Match and independently reads back", async () => {
    ports.direct.mockResolvedValueOnce({}).mockResolvedValueOnce({ ...self, summary: "Client — Coach House", etag: '"v2"' })
    const updated = await updateGoogleCoachingEventTitle({ coachId: "joel", googleEventId: self.id, summary: "Client — Coach House", etag: self.etag, sendUpdates: "all" })
    expect(ports.direct.mock.calls[0][0]).toMatchObject({ method: "PATCH", requestHeaders: { "If-Match": self.etag }, body: { summary: "Client — Coach House" } })
    expect(ports.direct.mock.calls[0][0].path).toContain("sendUpdates=all")
    expect(ports.direct.mock.calls[1][0].method).toBeUndefined()
    expect(updated.etag).toBe('"v2"')
  })

  it("broker retains stale-ETag failures without retrying", async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error("stale"), { status: 412 }))
    await expect(updateEventTitle({ coachId: "joel", googleEventId: self.id, summary: "Client", etag: self.etag, sendUpdates: "all" }, request)).rejects.toMatchObject({ status: 412 })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it("broker PATCHes only summary and reads protected fields back", async () => {
    const request = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(self)
    expect(await updateEventTitle({ coachId: "joel", googleEventId: self.id, summary: "Client", etag: self.etag, sendUpdates: "all" }, request)).toEqual(self)
    expect(request.mock.calls[0][0]).toMatchObject({ body: { summary: "Client" }, requestHeaders: { "If-Match": self.etag } })
    expect(request.mock.calls[1][0].method).toBeUndefined()
  })
})
