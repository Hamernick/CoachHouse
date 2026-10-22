import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  busy: vi.fn(), rpc: vi.fn(), confirm: vi.fn(), loadBooking: vi.fn(), credit: vi.fn(), inserted: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/env", () => ({ env: {} }))
vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "member", email: "member@example.test" } }, error: null }) } }),
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.inserted }) }),
}))
vi.mock("@/lib/organization/active-org", () => ({ resolveActiveOrganization: async () => ({ orgId: "org" }) }))
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }))
vi.mock("@/lib/user-journey", () => ({ trackUserJourneyMilestone: vi.fn() }))
vi.mock("@/lib/devtools/audience", () => ({ resolveDevtoolsAudience: vi.fn(), resolveTesterMetadata: vi.fn() }))
vi.mock("@/lib/billing/stripe-runtime", () => ({ resolveStripePriceIdForCoaching: vi.fn(), resolveStripeRuntimeConfigForCoaching: vi.fn() }))
vi.mock("@/features/coaching-booking/server/google-calendar", () => ({ isGoogleCoachingConfigured: () => true, listGoogleBusyWindows: mocks.busy }))
vi.mock("@/features/coaching-booking/server/booking-finalizer", () => ({ confirmCoachingBooking: mocks.confirm, loadCoachingBookingForConfirmation: mocks.loadBooking }))
vi.mock("@/features/coaching-booking/server/data", () => ({ listLocalBusyWindows: async () => [], resolveCoachingCreditSummary: mocks.credit }))
vi.mock("@/features/coaching-booking/server/calendar-reconciliation", () => ({ flushCoachingCalendarChange: async () => undefined }))

import { buildCandidateSlots, isCoachingSlotWithinSchedule } from "@/features/coaching-booking/lib/availability"
import { reserveCoachingBookingAction, rescheduleCoachingBookingAction } from "@/features/coaching-booking/server/actions"

function slots(from: string, to: string, timezone = "America/Chicago", busyWindows: Array<{ startsAt: string; endsAt: string }> = []) {
  return buildCandidateSlots({ coachId: "joel", from: new Date(from), to: new Date(to), timezone, busyWindows })
}
function chicagoHour(startsAt: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date(startsAt)))
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"))
  vi.clearAllMocks()
  mocks.busy.mockResolvedValue([])
  mocks.credit.mockResolvedValue({ priceTier: "included" })
  mocks.rpc.mockResolvedValue({ data: {}, error: null })
  mocks.loadBooking.mockResolvedValue({ id: "booking", user_id: "member", starts_at: "2026-10-26T14:00:00Z", ends_at: "2026-10-26T14:45:00Z", timezone: "America/Chicago", google_event_id: "event" })
  mocks.inserted.mockImplementation((booking) => ({ select: () => ({ single: async () => ({ data: { ...booking, id: "booking" }, error: null }) }) }))
  mocks.confirm.mockImplementation(async ({ booking }) => ({ ...booking, status: "confirmed" }))
})
afterEach(() => vi.useRealTimers())

describe("fixed Chicago coaching hours", () => {
  it("offers exactly the requested starts across a full week, retaining 45-minute meetings", () => {
    const result = slots("2026-10-26T05:00:00Z", "2026-11-02T06:00:00Z")
    const byDay: Record<string, number[]> = {}
    for (const slot of result) {
      const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(new Date(slot.startsAt))
      ;(byDay[day] ??= []).push(chicagoHour(slot.startsAt))
      expect(Date.parse(slot.endsAt) - Date.parse(slot.startsAt)).toBe(45 * 60_000)
    }
    const fullDay = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
    expect(byDay).toEqual({ Mon: fullDay, Tue: fullDay, Wed: [9, 10, 11, 12, 13, 14, 15, 16], Thu: fullDay, Sat: [10, 11, 12] })
    expect(result).toHaveLength(41)
  })

  it.each([
    ["2026-10-26", "2026-10-26T14:00:00.000Z"],
    ["2026-11-02", "2026-11-02T15:00:00.000Z"],
    ["2027-03-08", "2027-03-08T15:00:00.000Z"],
    ["2027-03-15", "2027-03-15T14:00:00.000Z"],
  ])("keeps 09:00 Chicago across DST changes on %s", (day, first) => {
    expect(slots(`${day}T00:00:00Z`, `${day}T23:59:59Z`)[0].startsAt).toBe(first)
  })

  it.each(["Pacific/Kiritimati", "Asia/Tokyo", "Pacific/Honolulu", "America/Los_Angeles", "UTC"])("viewer %s changes labels without moving coach starts", (timezone) => {
    const from = "2026-10-26T00:00:00Z", to = "2026-11-02T12:00:00Z"
    const chicago = slots(from, to)
    const viewer = slots(from, to, timezone)
    expect(viewer.map((slot) => slot.startsAt)).toEqual(chicago.map((slot) => slot.startsAt))
    expect(viewer.every((slot) => isCoachingSlotWithinSchedule(new Date(slot.startsAt), new Date(slot.endsAt)))).toBe(true)
    expect(viewer[0].timeLabel).toBe(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(viewer[0].startsAt)))
  })

  it("includes Monday's 18:00 Chicago start when the UTC query begins on Tuesday", () => {
    expect(slots("2026-11-03T00:00:00Z", "2026-11-03T00:01:00Z").map((slot) => slot.startsAt)).toEqual(["2026-11-03T00:00:00.000Z"])
  })

  it.each([
    ["2026-11-03T00:00:00+09:00", "2026-11-03T09:00:00+09:00", "Asia/Tokyo"],
    ["2026-11-02T00:00:00-10:00", "2026-11-03T00:00:00-10:00", "Pacific/Honolulu"],
  ])("clips viewer range %s to Chicago calendar days", (from, to, timezone) => {
    expect(slots(from, to, timezone).map((slot) => chicagoHour(slot.startsAt))).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it("preserves half-open busy boundaries and filters past starts", () => {
    vi.setSystemTime(new Date("2026-10-26T14:00:00Z"))
    const result = slots("2026-10-26T00:00:00Z", "2026-10-27T00:00:00Z", "UTC", [{ startsAt: "2026-10-26T15:45:00Z", endsAt: "2026-10-26T16:45:00Z" }])
    expect(result[0]).toMatchObject({ startsAt: "2026-10-26T15:00:00.000Z", available: true })
    expect(result[1]).toMatchObject({ startsAt: "2026-10-26T16:00:00.000Z", available: false })
    expect(result.every((slot) => Date.parse(slot.startsAt) > Date.now())).toBe(true)
  })
})

describe("server coaching-hour enforcement", () => {
  const invalidStarts = [
    "2026-10-26T13:00:00Z", // Monday 08:00
    "2026-10-27T00:00:00Z", // Monday 19:00
    "2026-10-28T22:00:00Z", // Wednesday 17:00
    "2026-10-30T14:00:00Z", // Friday
    "2026-10-31T14:00:00Z", // Saturday 09:00
    "2026-10-31T18:00:00Z", // Saturday 13:00
    "2026-11-01T16:00:00Z", // Sunday
    "2026-10-26T14:30:00Z", // Half-hour
    "2026-10-26T14:00:01Z", // Seconds
    "2026-10-26T14:00:00.001Z", // Milliseconds
  ]
  it.each(invalidStarts)("rejects direct reservation %s before calendar reads, credits or writes", async (startsAt) => {
    const result = await reserveCoachingBookingAction({ coachId: "joel", startsAt, timezone: "Pacific/Kiritimati" })
    expect(result).toMatchObject({ ok: false, code: "COACHING_SLOT_UNAVAILABLE" })
    expect(mocks.busy).not.toHaveBeenCalled()
    expect(mocks.credit).not.toHaveBeenCalled()
    expect(mocks.inserted).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it.each(invalidStarts)("rejects reschedule target %s before calendar reads or mutation", async (startsAt) => {
    const result = await rescheduleCoachingBookingAction({ bookingId: "booking", startsAt, timezone: "Pacific/Honolulu", requestId: "request" })
    expect(result).toMatchObject({ ok: false, code: "COACHING_SLOT_UNAVAILABLE" })
    expect(mocks.busy).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each(["2026-10-26T23:00:00Z", "2026-10-28T21:00:00Z", "2026-10-31T17:00:00Z"])("accepts the last allowed start %s despite a different viewer timezone", async (startsAt) => {
    expect(await reserveCoachingBookingAction({ coachId: "joel", startsAt, timezone: "Pacific/Kiritimati" })).toMatchObject({ ok: true, confirmed: true })
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ starts_at: new Date(startsAt).toISOString(), ends_at: new Date(Date.parse(startsAt) + 45 * 60_000).toISOString() }))
    expect(await rescheduleCoachingBookingAction({ bookingId: "booking", startsAt, timezone: "Pacific/Honolulu", requestId: "request" })).toEqual({ ok: true, success: true })
    expect(mocks.rpc).toHaveBeenCalledWith("manage_coaching_credit_booking", expect.objectContaining({ p_starts_at: new Date(startsAt).toISOString() }))
  })
})
