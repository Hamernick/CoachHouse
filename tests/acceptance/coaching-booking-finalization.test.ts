import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const mocks = vi.hoisted(() => ({
  available: vi.fn(), name: vi.fn(), create: vi.fn(), remove: vi.fn(),
  email: vi.fn(), notification: vi.fn(), journey: vi.fn(), admin: vi.fn(), retrieve: vi.fn(),
  reserve: vi.fn(), cancel: vi.fn(), transition: vi.fn(), refresh: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(),
}))
vi.mock("react", () => ({ useTransition: () => [false, mocks.transition] }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))
vi.mock("@/features/coaching-booking/actions", () => ({ reserveCoachingBookingAction: mocks.reserve, cancelCoachingBookingAction: mocks.cancel }))
vi.mock("@/features/coaching-booking/server/calendar-conflicts", () => ({ assertCoachingCalendarAvailable: mocks.available }))
vi.mock("@/features/coaching-booking/server/coaching-client-name", () => ({ loadCoachingClientName: mocks.name }))
vi.mock("@/features/coaching-booking/server/google-calendar", () => ({
  createGoogleCoachingEvent: mocks.create, deleteGoogleCoachingEvent: mocks.remove,
  getGoogleCoachingParticipantEmail: (coach: string) => `${coach}@example.test`,
}))
vi.mock("@/features/coaching-booking/server/email", () => ({ sendCoachingBookingConfirmationEmails: mocks.email }))
vi.mock("@/lib/notifications", () => ({ createNotification: mocks.notification }))
vi.mock("@/lib/user-journey", () => ({ trackUserJourneyMilestone: mocks.journey }))
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/billing/stripe-runtime", () => ({
  resolveStripeRuntimeConfigsForFallback: () => [{ client: { checkout: { sessions: { retrieve: mocks.retrieve } } } }],
}))

import { confirmCoachingBooking } from "@/features/coaching-booking/server/booking-finalizer"
import { confirmPaidCoachingCheckoutReturn } from "@/features/coaching-booking/server/checkout-return"
import { useCoachingBookingActions } from "@/features/coaching-booking/hooks/use-coaching-booking-actions"

const BOOKING = {
  id: "12345678-1234-4234-8234-123456789abc", org_id: "org", user_id: "member", coach_id: "joel",
  status: "held", price_tier: "included", starts_at: "2099-01-01T15:00:00Z", ends_at: "2099-01-01T15:45:00Z",
  timezone: "America/Chicago", attendee_notes: "Bring the budget", google_event_id: null as string | null,
  google_meet_url: null as string | null, calendar_pending_action: null as string | null,
  stripe_checkout_session_id: null as string | null, cancel_reason: null as string | null,
}
const EVENT = {
  googleEventId: BOOKING.id.replaceAll("-", ""), googleMeetUrl: "https://meet.google.com/abc-defg-hij",
  googleEventHtmlLink: "https://calendar.google.com/calendar/event?eid=test",
}
const CONFLICT = Object.assign(new Error("That slot was just taken. Pick another time."), { code: "COACHING_SLOT_UNAVAILABLE" })

function installAdmin(input: Partial<typeof BOOKING> = {}) {
  const state = { ...BOOKING, ...input }
  const updates: Array<Record<string, unknown>> = []
  const grants = new Set<string>()
  const admin = {
    from: vi.fn((table: string) => {
      expect(table).toBe("coaching_bookings")
      let patch: Record<string, unknown> | undefined
      const matches: Array<(row: typeof state) => boolean> = []
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          matches.push((row) => row[column as keyof typeof state] === value)
          return query
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          matches.push((row) => values.includes(row[column as keyof typeof state]))
          return query
        }),
        update: vi.fn((value: Record<string, unknown>) => { patch = value; updates.push(value); return query }),
        maybeSingle: vi.fn(async () => {
          if (!matches.every((matchesRow) => matchesRow(state))) return { data: null, error: null }
          if (patch) Object.assign(state, patch)
          return { data: { ...state }, error: null }
        }),
      }
      return query
    }),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "issue_coaching_credits") grants.add(String(args.p_request_key))
      if (name === "confirm_coaching_credit_booking") Object.assign(state, { status: "confirmed", calendar_pending_action: "create", google_event_id: EVENT.googleEventId })
      return { data: "grant-id", error: null }
    }),
  }
  mocks.admin.mockReturnValue(admin)
  return { admin, state, updates, grants, booking: { ...state } }
}
function finalize(fixture: ReturnType<typeof installAdmin>) {
  return confirmCoachingBooking({ admin: fixture.admin as never, booking: fixture.booking, attendeeEmail: "member@example.test" })
}
function paidReturn() {
  return confirmPaidCoachingCheckoutReturn({ bookingId: BOOKING.id, userId: "member", orgId: "org", userEmail: "member@example.test" })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.available.mockReset().mockResolvedValue(undefined)
  mocks.name.mockReset().mockResolvedValue("John Smith")
  mocks.create.mockReset().mockResolvedValue(EVENT)
  mocks.notification.mockReset().mockResolvedValue({})
  mocks.email.mockReset().mockResolvedValue(undefined)
  mocks.journey.mockReset().mockResolvedValue(undefined)
  mocks.retrieve.mockReset().mockResolvedValue({
    id: "cs_test_paid", mode: "payment", metadata: { kind: "coaching_booking", booking_id: BOOKING.id },
    payment_status: "paid", payment_intent: "pi_paid", customer: "cus_paid",
  })
  mocks.transition.mockReset().mockImplementation((callback: () => Promise<void>) => callback())
  mocks.reserve.mockReset()
})

describe("coaching booking finalization", () => {
  it.each([
    ["2099-01-02T15:00:00Z", "2099-01-02T15:45:00Z"], // Friday
    ["2099-01-01T15:30:00Z", "2099-01-01T16:15:00Z"], // Off-hour
    ["2099-01-01T15:00:00Z", "2099-01-01T16:00:00Z"], // Wrong duration
  ])("rejects an unconfirmed outside-schedule checkout before consuming a credit: %s", async (starts_at, ends_at) => {
    const fixture = installAdmin({ status: "pending_payment", starts_at, ends_at })
    expect((await finalize(fixture)).status).toBe("canceled")
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.available).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("preserves an established Friday meeting while retrying its pending calendar creation", async () => {
    const fixture = installAdmin({ status: "confirmed", calendar_pending_action: "create", starts_at: "2099-01-02T15:00:00Z", ends_at: "2099-01-02T15:45:00Z", google_event_id: EVENT.googleEventId })
    expect((await finalize(fixture)).status).toBe("confirmed")
    expect(mocks.available).toHaveBeenCalled()
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ startsAt: "2099-01-02T15:00:00Z" }))
  })

  it("waits for fresh availability before reserving a credit or creating an event", async () => {
    const fixture = installAdmin()
    let release!: () => void
    mocks.available.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    const pending = finalize(fixture)
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    release()
    await pending
    expect(mocks.available.mock.invocationCallOrder[0]).toBeLessThan(fixture.admin.rpc.mock.invocationCallOrder[0])
  })

  it("leaves the reservation and credit untouched when calendar verification fails", async () => {
    const fixture = installAdmin()
    mocks.available.mockRejectedValue(new Error("Calendar unavailable"))
    await expect(finalize(fixture)).rejects.toThrow("Calendar unavailable")
    expect(fixture.state.status).toBe("held")
    expect(fixture.updates).toEqual([])
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
  })

  it("releases a definitively conflicting pending slot without debit, invite or email", async () => {
    const fixture = installAdmin({ status: "pending_payment" })
    mocks.available.mockRejectedValue(CONFLICT)
    expect((await finalize(fixture)).status).toBe("canceled")
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
  })

  it("releases a slot rejected by the transactional conflict guard", async () => {
    const fixture = installAdmin()
    fixture.admin.rpc.mockResolvedValueOnce({ data: "", error: { code: "23P01", message: "That slot was just taken" } } as never)
    expect((await finalize(fixture)).status).toBe("canceled")
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
  })

  it("cannot cancel a concurrently confirmed booking from a stale pending snapshot", async () => {
    const fixture = installAdmin({ status: "pending_payment" })
    mocks.available.mockImplementation(async () => {
      Object.assign(fixture.state, { status: "confirmed", google_event_id: EVENT.googleEventId })
      throw CONFLICT
    })
    expect((await finalize(fixture)).status).toBe("confirmed")
    expect(fixture.state.status).toBe("confirmed")
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("reuses completed confirmation without repeating provider calls, debit or emails", async () => {
    const fixture = installAdmin({ status: "confirmed", google_event_id: EVENT.googleEventId })
    expect((await finalize(fixture)).status).toBe("confirmed")
    expect(mocks.available).not.toHaveBeenCalled()
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
  })

  it("preserves an already confirmed reservation when a create retry finds an external conflict", async () => {
    const fixture = installAdmin({ status: "confirmed", google_event_id: EVENT.googleEventId, calendar_pending_action: "create" })
    mocks.available.mockRejectedValue(CONFLICT)
    await expect(finalize(fixture)).rejects.toMatchObject({ code: "COACHING_SLOT_UNAVAILABLE" })
    expect(fixture.state.status).toBe("confirmed")
    expect(fixture.updates).toEqual([])
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("uses the saved client name and deterministic identity for invitations and retries", async () => {
    const fixture = installAdmin()
    await finalize(fixture)
    expect(mocks.name).toHaveBeenCalledWith({ supabase: fixture.admin, userId: "member" })
    expect(mocks.available).toHaveBeenCalledWith(expect.objectContaining({ excludeGoogleEventId: EVENT.googleEventId }))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      eventId: EVENT.googleEventId, summary: "John Smith — Coach House meeting with Joel & Paula",
      internalAttendeeEmails: ["paula@example.test"], attendeeEmail: "member@example.test",
    }))
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ attendeeName: "John Smith" }))
  })

  it("keeps a durable confirmed reservation when event delivery fails after debit", async () => {
    const fixture = installAdmin()
    mocks.create.mockRejectedValue(new Error("Google temporarily unavailable"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      expect((await finalize(fixture)).status).toBe("confirmed")
      expect(fixture.state).toMatchObject({ status: "confirmed", calendar_pending_action: "create", google_event_id: EVENT.googleEventId })
      expect(mocks.email).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })

  it("returns the actual concurrent cancellation when event delivery also fails", async () => {
    const fixture = installAdmin()
    mocks.create.mockImplementation(async () => {
      Object.assign(fixture.state, { status: "canceled", cancel_reason: "Member canceled with less than four hours notice." })
      throw new Error("Google temporarily unavailable")
    })
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      expect(await finalize(fixture)).toMatchObject({ status: "canceled", cancel_reason: "Member canceled with less than four hours notice." })
      expect(mocks.email).not.toHaveBeenCalled()
      expect(mocks.notification).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
})

describe("paid coaching checkout conflict return", () => {
  it("records the paid credit before conflict handling and reports no confirmed meeting", async () => {
    const fixture = installAdmin({ status: "pending_payment", price_tier: "full", stripe_checkout_session_id: "cs_test_paid" })
    mocks.available.mockRejectedValue(CONFLICT)
    const result = await paidReturn()
    expect(result).toMatchObject({ confirmed: false, slotUnavailable: true })
    expect(fixture.grants).toEqual(new Set(["checkout:cs_test_paid"]))
    expect(fixture.admin.rpc).toHaveBeenCalledWith("issue_coaching_credits", expect.objectContaining({ p_quantity: 1, p_source_type: "purchased" }))
    expect(fixture.admin.rpc).not.toHaveBeenCalledWith("confirm_coaching_credit_booking", expect.anything())
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
  })

  it("preserves a paid credit when a pending Friday checkout falls outside the new schedule", async () => {
    const fixture = installAdmin({ status: "pending_payment", price_tier: "full", stripe_checkout_session_id: "cs_test_paid", starts_at: "2099-01-02T15:00:00Z", ends_at: "2099-01-02T15:45:00Z" })
    expect(await paidReturn()).toMatchObject({ confirmed: false, slotUnavailable: true })
    expect(fixture.grants).toEqual(new Set(["checkout:cs_test_paid"]))
    expect(fixture.state.status).toBe("canceled")
    expect(fixture.admin.rpc).not.toHaveBeenCalledWith("confirm_coaching_credit_booking", expect.anything())
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("never retrieves or grants a checkout belonging to another member", async () => {
    const fixture = installAdmin({ status: "pending_payment", user_id: "other", stripe_checkout_session_id: "cs_test_paid" })
    expect(await paidReturn()).toEqual({ confirmed: false })
    expect(mocks.retrieve).not.toHaveBeenCalled()
    expect(fixture.admin.rpc).not.toHaveBeenCalled()
  })

  it("keeps an unavailable paid checkout retry canceled and its purchased credit available", async () => {
    const fixture = installAdmin({ status: "pending_payment", price_tier: "full", stripe_checkout_session_id: "cs_test_paid" })
    mocks.available.mockRejectedValue(CONFLICT)
    await paidReturn()
    expect(await paidReturn()).toMatchObject({ confirmed: false, slotUnavailable: true })
    expect(fixture.grants).toEqual(new Set(["checkout:cs_test_paid"]))
    expect(fixture.state.status).toBe("canceled")
    expect(mocks.retrieve).toHaveBeenCalledOnce()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it.each([
    ["Member canceled with less than four hours notice.", false],
    [CONFLICT.message, true],
  ])("reports concurrent cancellation during confirmed event retry accurately: %s", async (reason, unavailable) => {
    const fixture = installAdmin({ status: "confirmed", price_tier: "full", stripe_checkout_session_id: "cs_test_paid", google_event_id: EVENT.googleEventId, calendar_pending_action: "create" })
    mocks.create.mockImplementation(async () => {
      Object.assign(fixture.state, { status: "canceled", cancel_reason: reason })
      return EVENT
    })
    expect(await paidReturn()).toEqual({ confirmed: false, slotUnavailable: unavailable })
    expect(mocks.retrieve).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledWith({ coachId: "joel", googleEventId: EVENT.googleEventId })
  })

  it("does not promise restored credit for a paid booking canceled late during delivery", async () => {
    const fixture = installAdmin({ status: "pending_payment", price_tier: "full", stripe_checkout_session_id: "cs_test_paid" })
    mocks.create.mockImplementation(async () => {
      Object.assign(fixture.state, { status: "canceled", cancel_reason: "Member canceled with less than four hours notice." })
      return EVENT
    })
    expect(await paidReturn()).toEqual({ confirmed: false, slotUnavailable: false })
    expect(fixture.grants).toEqual(new Set(["checkout:cs_test_paid"]))
    expect(fixture.admin.rpc).not.toHaveBeenCalledWith("restore_coaching_credit", expect.anything())
    expect(mocks.email).not.toHaveBeenCalled()
  })
})

describe("coaching slot conflict recovery", () => {
  it("asks the flow to refresh unavailable slots while preserving the submitted notes", async () => {
    const onUnavailable = vi.fn()
    const onBooked = vi.fn()
    mocks.reserve.mockResolvedValue({ ok: false, code: "COACHING_SLOT_UNAVAILABLE", error: CONFLICT.message })
    const notes = "Keep these meeting questions"
    const hook = useCoachingBookingActions({
      selectedSlot: { id: "slot", coachId: "joel", startsAt: BOOKING.starts_at, endsAt: BOOKING.ends_at, dateLabel: "Jan 1", timeLabel: "12 PM", available: true },
      selectedCoachId: "joel", checkoutUnavailable: false, timezone: BOOKING.timezone, attendeeNotes: notes,
      onUnavailable, onBooked,
    })
    hook.confirmSelection()
    await mocks.transition.mock.results.at(-1)?.value
    expect(onUnavailable).toHaveBeenCalledOnce()
    expect(onBooked).not.toHaveBeenCalled()
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({ attendeeNotes: notes }))
    expect(mocks.toastError).toHaveBeenCalledWith(CONFLICT.message)
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it("wires conflict recovery to clear stale slots and refetch without resetting notes", () => {
    const flow = readFileSync(join(process.cwd(), "src/features/coaching-booking/components/coaching-booking-flow.tsx"), "utf8")
    const callback = flow.match(/onUnavailable:\s*\(\) => \{([\s\S]*?)\n\s*\},/)?.[1]
    expect(callback).toBeDefined()
    expect(callback).toContain("setSelectedSlot(null)")
    expect(callback).toContain("setSlots([])")
    expect(callback).toContain("setAvailabilityRevision")
    expect(callback).toContain('setStep("time")')
    expect(callback).not.toContain("setAttendeeNotes")
  })
})
