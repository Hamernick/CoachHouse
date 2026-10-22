import { describe, expect, it, vi } from "vitest"
import { mkdtemp, readFile, stat, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseTitleBackfillArgs, parseApprovedTitleManifest, reservePrivateTitleReceipt, runTitleBackfillCli } from "@/features/coaching-booking/server/title-backfill-cli"
import { buildCoachingCalendarTitle } from "@/features/coaching-booking/lib/calendar-title"
import { buildCoachingBookingEmail } from "@/features/coaching-booking/lib/email-templates"
import { loadCoachingClientName } from "@/features/coaching-booking/server/coaching-client-name"
import {
  backfillCoachingCalendarTitles,
  type CoachingTitleBackfillEntry,
  type CoachingTitleBackfillBooking,
  type CoachingTitleBackfillPorts,
} from "@/features/coaching-booking/server/title-backfill"

vi.mock("@/features/coaching-booking/server/calendar-event-titles", () => ({
  readGoogleCoachingEventForTitle: vi.fn(), updateGoogleCoachingEventTitle: vi.fn(),
}))

const now = new Date("2026-10-21T12:00:00Z")
const booking: CoachingTitleBackfillBooking = {
  id: "booking-1", user_id: "client-1", coach_id: "joel", status: "confirmed",
  starts_at: "2026-10-25T14:00:00Z", ends_at: "2026-10-25T14:45:00Z",
  google_event_id: "event-1", calendar_pending_action: null,
}
function fixture(overrides = {}) {
  const event = {
    id: "event-1", etag: '"version-1"', status: "confirmed", summary: "Coach House meeting with Joel & Paula",
    organizer: { email: "joel@example.org", self: true },
    start: { dateTime: booking.starts_at, timeZone: "America/New_York" },
    end: { dateTime: booking.ends_at, timeZone: "America/New_York" },
    attendees: [{ email: "client@example.org", responseStatus: "accepted" }],
    hangoutLink: "https://meet.google.com/abc-defg-hij", iCalUID: "same-uid",
    conferenceData: { conferenceId: "abc-defg-hij" }, description: "Keep these notes", ...overrides,
  }
  const ports: CoachingTitleBackfillPorts = {
    loadClientName: vi.fn(async () => "John Smith"),
    readEvent: vi.fn(async () => structuredClone(event)),
    updateTitle: vi.fn(async ({ summary }) => { event.summary = summary; event.etag = '"version-2"' }),
  }
  return { ports, event }
}

async function dryRun(ports: CoachingTitleBackfillPorts, bookings = [booking]) {
  return backfillCoachingCalendarTitles({ bookings, ports, now })
}

describe("client-first coaching titles", () => {
  it("uses saved names consistently, normalizes controls, and uses a neutral fallback", () => {
    expect(buildCoachingCalendarTitle("  John\nSmith  ")).toBe("John Smith — Coach House meeting with Joel & Paula")
    expect(buildCoachingCalendarTitle(null)).toBe("Client — Coach House meeting with Joel & Paula")
    expect(buildCoachingCalendarTitle("  ")).toBe("Client — Coach House meeting with Joel & Paula")
    const email = buildCoachingBookingEmail({ audience: "coach", siteUrl: "https://coachhouse.app", attendeeName: "John Smith", attendeeEmail: "john@example.org", startsAt: booking.starts_at, endsAt: booking.ends_at, timezone: "UTC", googleEventHtmlLink: null, googleMeetUrl: null })
    expect(email.text).toContain(buildCoachingCalendarTitle("John Smith"))
  })

  it("loads the booking user's profile, without guessing from email or organization", async () => {
    const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: { full_name: " John Smith " }, error: null }) }))
    const supabase = { from: vi.fn(() => ({ select: () => ({ eq }) })) }
    expect(await loadCoachingClientName({ supabase: supabase as never, userId: booking.user_id })).toBe("John Smith")
    expect(supabase.from).toHaveBeenCalledWith("profiles")
    expect(eq).toHaveBeenCalledWith("id", booking.user_id)
  })

  it("defaults to a read-only manifest and requires exact reviewed entries to apply", async () => {
    const { ports } = fixture()
    const plan = await dryRun(ports)
    expect(plan.entries[0]).toMatchObject({ result: "ready", proposedTitle: buildCoachingCalendarTitle("John Smith") })
    expect(ports.updateTitle).not.toHaveBeenCalled()
    const unapproved = await backfillCoachingCalendarTitles({ bookings: [booking], ports, now, apply: true })
    expect(unapproved.entries[0].reason).toBe("unapproved_or_changed_since_dry_run")
    expect(ports.updateTitle).not.toHaveBeenCalled()
    const result = await backfillCoachingCalendarTitles({ bookings: [booking], ports, now, apply: true, approvedEntries: plan.entries })
    expect(result.entries[0].result).toBe("updated")
    expect(ports.updateTitle).toHaveBeenCalledWith({ coachId: "joel", googleEventId: "event-1", summary: buildCoachingCalendarTitle("John Smith"), etag: '"version-1"', sendUpdates: "all" })
  })

  it.each([
    [{ recurringEventId: "series-1" }, "recurring_event_identity_ambiguous"],
    [{ recurrence: ["RRULE:FREQ=WEEKLY"] }, "recurring_event_identity_ambiguous"],
    [{ summary: "Custom client agenda" }, "custom_or_already_updated_title"],
    [{ summary: buildCoachingCalendarTitle("John Smith") }, "custom_or_already_updated_title"],
    [{ organizer: { email: "joel@example.org", self: false } }, "organizer_access_unverified"],
    [{ status: "cancelled" }, "event_not_confirmed"],
    [{ id: "other-event" }, "event_identity_mismatch"],
    [{ etag: "" }, "missing_etag"],
    [{ start: { dateTime: "2026-10-25T15:00:00Z" } }, "calendar_time_drift"],
  ])("skips unsafe calendar snapshots %#", async (overrides, reason) => {
    const { ports } = fixture(overrides)
    expect((await dryRun(ports)).entries[0].reason).toBe(reason)
    expect(ports.updateTitle).not.toHaveBeenCalled()
  })

  it("skips missing names, duplicate event mappings, past and pending bookings", async () => {
    const { ports } = fixture()
    vi.mocked(ports.loadClientName).mockResolvedValue(null)
    expect((await dryRun(ports)).entries[0].reason).toBe("missing_client_name")
    expect((await dryRun(ports, [booking, { ...booking, id: "other" }])).entries.every((entry) => entry.reason === "ambiguous_event_id")).toBe(true)
    expect((await dryRun(ports, [{ ...booking, starts_at: now.toISOString() }])).entries[0].reason).toBe("not_upcoming_confirmed")
    expect((await dryRun(ports, [{ ...booking, calendar_pending_action: "update" }])).entries[0].reason).toBe("calendar_change_pending")
  })

  it("journals the exact attempted write before changing a live event", async () => {
    const { ports, event } = fixture()
    const plan = await dryRun(ports)
    const snapshots: unknown[] = []
    const onProgress = vi.fn(async (entries: CoachingTitleBackfillEntry[]) => { snapshots.push(structuredClone(entries)) })
    vi.mocked(ports.updateTitle).mockImplementation(async ({ summary }) => {
      expect(snapshots.at(-1)).toMatchObject([{ verification: "unverified", etag: '\"version-1\"' }])
      event.summary = summary
    })
    await backfillCoachingCalendarTitles({ bookings: [booking], ports, now, apply: true, approvedEntries: plan.entries, onProgress })
    expect(snapshots.at(-1)).toMatchObject([{ result: "updated", verification: "verified" }])
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it("detects any protected-field drift in independent readback", async () => {
    const { ports, event } = fixture()
    const plan = await dryRun(ports)
    vi.mocked(ports.updateTitle).mockImplementation(async ({ summary }) => { event.summary = summary; event.attendees[0].responseStatus = "needsAction" })
    const result = await backfillCoachingCalendarTitles({ bookings: [booking], ports, now, apply: true, approvedEntries: plan.entries })
    expect(result.entries[0]).toMatchObject({ result: "verification_failed", reason: "event_readback_mismatch" })
  })

  it("rejects stale approvals and stops on a 412 rather than blindly retrying", async () => {
    const { ports, event } = fixture()
    const plan = await dryRun(ports)
    event.etag = '"changed"'
    expect((await backfillCoachingCalendarTitles({ bookings: [booking], ports, now, apply: true, approvedEntries: plan.entries })).entries[0].reason).toBe("unapproved_or_changed_since_dry_run")
    event.etag = '"version-1"'
    vi.mocked(ports.updateTitle).mockRejectedValue(Object.assign(new Error("Changed"), { status: 412 }))
    const result = await backfillCoachingCalendarTitles({ bookings: [booking, { ...booking, id: "booking-2", google_event_id: "event-2" }], ports, now, apply: true, approvedEntries: plan.entries })
    expect(result.entries[0]).toMatchObject({ result: "failed", reason: "concurrent_event_change" })
    expect(result).toMatchObject({ totalBookings: 2, remaining: 1 })
    expect(ports.updateTitle).toHaveBeenCalledTimes(1)
  })
})


describe("private title-backfill operator", () => {
  it("defaults to preview and requires exact explicit apply arguments", () => {
    expect(parseTitleBackfillArgs(["--output", "/tmp/preview.json"]).apply).toBe(false)
    expect(() => parseTitleBackfillArgs(["--output", "preview.json"])).toThrow()
    expect(() => parseTitleBackfillArgs(["--output", "/tmp/apply.json", "--apply"])).toThrow()
    expect(() => parseTitleBackfillArgs(["--output", "/tmp/preview.json", "--limit", "501"])).toThrow()
    expect(() => parseTitleBackfillArgs(["--output", "/tmp/preview.json", "--apply", "--apply"])).toThrow()
  })

  it("bounds and validates approved manifests", async () => {
    const { ports } = fixture()
    const plan = await dryRun(ports)
    expect(parseApprovedTitleManifest({ schemaVersion: 1, ...plan })).toEqual(plan.entries)
    expect(() => parseApprovedTitleManifest({ schemaVersion: 1, mode: "apply", entries: [] })).toThrow()
    expect(() => parseApprovedTitleManifest({ schemaVersion: 1, mode: "dry_run", entries: [plan.entries[0], plan.entries[0]] })).toThrow()
    expect(() => parseApprovedTitleManifest({ schemaVersion: 1, mode: "dry_run", entries: [{ ...plan.entries[0], protectedDigestBefore: undefined }] })).toThrow()
  })

  it("reserves new 0600 receipts outside worktrees without overwriting existing files", async () => {
    const folder = await mkdtemp(join(tmpdir(), "coaching-title-cli-"))
    const output = join(folder, "receipt.json")
    try {
      const file = await reservePrivateTitleReceipt(output)
      await file.writeFile("private")
      await file.close()
      expect((await stat(output)).mode & 0o777).toBe(0o600)
      await expect(reservePrivateTitleReceipt(output)).rejects.toThrow()
      expect(await readFile(output, "utf8")).toBe("private")
      await expect(reservePrivateTitleReceipt(join(process.cwd(), "private-receipt.json"))).rejects.toThrow("outside")
    } finally { await rm(folder, { recursive: true, force: true }) }
  })
})


it("saves a private fatal receipt when approval validation fails before any live access", async () => {
  const folder = await mkdtemp(join(tmpdir(), "coaching-title-failure-"))
  const approved = join(folder, "approved.json")
  const output = join(folder, "failure.json")
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    await writeFile(approved, JSON.stringify({ schemaVersion: 1, mode: "apply", entries: [] }), { mode: 0o600 })
    expect(await runTitleBackfillCli(["--apply", "--approved", approved, "--output", output])).toBe(1)
    expect(JSON.parse(await readFile(output, "utf8"))).toMatchObject({ status: "failed", reason: "operator_setup_or_scan_failed", entries: [] })
    expect((await stat(output)).mode & 0o777).toBe(0o600)
  } finally { stderr.mockRestore(); await rm(folder, { recursive: true, force: true }) }
})
