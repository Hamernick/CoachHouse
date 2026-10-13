import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  env: { GOOGLE_CALENDAR_CRON_SECRET: undefined as string | undefined },
  admin: vi.fn(),
  eventState: vi.fn(),
  confirm: vi.fn(),
  loadBooking: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}))
vi.mock("@/lib/env", () => ({ env: mocks.env }))
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/features/coaching-booking/server/google-event-state", () => {
  return { loadGoogleCoachingEventState: mocks.eventState }
})
vi.mock("@/features/coaching-booking/server/google-calendar", () => {
  return { updateGoogleCoachingEvent: mocks.updateEvent, deleteGoogleCoachingEvent: mocks.deleteEvent }
})
vi.mock("@/features/coaching-booking/server/booking-finalizer", () => {
  return { confirmCoachingBooking: mocks.confirm, loadCoachingBookingForConfirmation: mocks.loadBooking }
})

const SECRET = "test-only-".repeat(4)
const BOOKING = {
  id: "booking-1", coach_id: "joel", google_event_id: "event-1",
  calendar_pending_action: null as string | null,
  starts_at: "2026-10-12T12:00:00Z", ends_at: "2026-10-12T13:00:00Z",
  status: "confirmed", credit_revision: 1, user_id: "member", timezone: "UTC",
}

function installAdmin(rows: Array<typeof BOOKING> = [], error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error })),
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }
  const admin = {
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ error: null })),
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "member@example.test" } }, error: null })) } },
  }
  mocks.admin.mockReturnValue(admin)
  return { admin, query }
}

async function invoke(authorization = `Bearer ${SECRET}`) {
  const { coachingCalendarCron } = await import("@/features/coaching-booking/server/calendar-cron")
  return coachingCalendarCron(new NextRequest("https://coachhouse.test/api/internal/cron/coaching-calendar", {
    headers: { authorization, cookie: "sb-test-auth-token=browser-session" },
  }))
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.env.GOOGLE_CALENDAR_CRON_SECRET = SECRET
  mocks.eventState.mockReset().mockResolvedValue({ status: "confirmed", startsAt: BOOKING.starts_at, endsAt: BOOKING.ends_at })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.loadBooking.mockReset().mockResolvedValue(BOOKING)
})

describe("coaching calendar cron", () => {
  it.each(["", "Bearer wrong", `Bearer ${"x".repeat(SECRET.length)}`, SECRET])("rejects invalid authorization %s before processing work", async (authorization) => {
    const response = await invoke(authorization)
    expect(response.status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it.each([undefined, "short"])("rejects missing or weak configured secrets", async (secret) => {
    mocks.env.GOOGLE_CALENDAR_CRON_SECRET = secret
    expect((await invoke(`Bearer ${secret ?? ""}`)).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it("does not call Google or confirm bookings for an empty queue", async () => {
    installAdmin()
    const response = await invoke()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ processed: 0, failed: 0 })
    expect(mocks.eventState).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it("preserves queue failures without provider calls", async () => {
    installAdmin([], { message: "Database unavailable" })
    expect((await invoke()).status).toBe(503)
  })

  it("checks confirmed events without creating bookings", async () => {
    const { query, admin } = installAdmin([BOOKING])
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(mocks.eventState).toHaveBeenCalledWith("joel", "event-1")
    expect(query.limit).toHaveBeenCalledWith(40)
    expect(query.order).toHaveBeenCalledWith("calendar_checked_at", { ascending: true, nullsFirst: true })
    expect(query.update).toHaveBeenCalledWith({ calendar_checked_at: expect.any(String) })
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it("preserves explicit cancellation refunds", async () => {
    const { admin } = installAdmin([BOOKING])
    mocks.eventState.mockResolvedValue({ status: "cancelled", startsAt: null, endsAt: null })
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(admin.rpc).toHaveBeenCalledWith("manage_coaching_credit_booking", expect.objectContaining({ p_booking_id: BOOKING.id, p_action: "calendar_cancel" }))
  })

  it("preserves rescheduling and its expected-start guard", async () => {
    const { admin } = installAdmin([BOOKING])
    mocks.eventState.mockResolvedValue({ status: "confirmed", startsAt: "2026-10-13T12:00:00Z", endsAt: "2026-10-13T13:00:00Z" })
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(admin.rpc).toHaveBeenCalledWith("manage_coaching_credit_booking", expect.objectContaining({ p_action: "reschedule", p_expected_starts_at: BOOKING.starts_at }))
  })

  it("does not refund on provider failure and keeps the retry timestamp", async () => {
    const { admin, query } = installAdmin([BOOKING])
    mocks.eventState.mockRejectedValue(new Error("Calendar unavailable"))
    expect(await (await invoke()).json()).toEqual({ processed: 0, failed: 1 })
    expect(admin.rpc).not.toHaveBeenCalled()
    expect(query.update).toHaveBeenCalledOnce()
  })

  it("preserves booking confirmation for pending creates", async () => {
    installAdmin([{ ...BOOKING, calendar_pending_action: "create", google_event_id: "" }])
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ booking: BOOKING, attendeeEmail: "member@example.test" }))
  })

  it.each(["update", "delete"])("preserves pending %s and optimistic update guards", async (action) => {
    const { query } = installAdmin([{ ...BOOKING, calendar_pending_action: action }])
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(action === "delete" ? mocks.deleteEvent : mocks.updateEvent).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith("credit_revision", BOOKING.credit_revision)
    expect(query.eq).toHaveBeenCalledWith("calendar_pending_action", action)
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it("does not delete a Google event that is already cancelled", async () => {
    const { query } = installAdmin([{ ...BOOKING, calendar_pending_action: "delete" }])
    mocks.eventState.mockResolvedValue({ status: "cancelled", startsAt: null, endsAt: null })
    expect(await (await invoke()).json()).toEqual({ processed: 1, failed: 0 })
    expect(mocks.deleteEvent).not.toHaveBeenCalled()
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ calendar_pending_action: null }))
  })

  it("preserves the processing deadline without starting provider work", async () => {
    const { query } = installAdmin([BOOKING])
    const { reconcileCoachingCalendar } = await import("@/features/coaching-booking/server/calendar-reconciliation")
    expect(await reconcileCoachingCalendar(Date.now())).toEqual({ processed: 0, failed: 0 })
    expect(query.update).not.toHaveBeenCalled()
    expect(mocks.eventState).not.toHaveBeenCalled()
  })
})
