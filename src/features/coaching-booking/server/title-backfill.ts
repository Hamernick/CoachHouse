import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { buildCoachingCalendarTitle, normalizeCoachingClientName } from "../lib/calendar-title"
import { COACHING_JOINT_COACH_LABEL, normalizeCoachId } from "../lib"
import type { CoachingCoachId } from "../types"
import { loadCoachingClientName } from "./coaching-client-name"
import {
  readGoogleCoachingEventForTitle,
  updateGoogleCoachingEventTitle,
  type GoogleCoachingTitleEvent,
} from "./calendar-event-titles"

export type CoachingTitleBackfillBooking = {
  id: string
  user_id: string
  coach_id: string
  status: string
  starts_at: string
  ends_at: string
  google_event_id: string | null
  calendar_pending_action: string | null
}

type TitleEventKey = { coachId: CoachingCoachId; googleEventId: string }
export type CoachingTitleBackfillPorts = {
  loadClientName: (userId: string) => Promise<string | null>
  readEvent: (key: TitleEventKey) => Promise<GoogleCoachingTitleEvent>
  updateTitle: (input: TitleEventKey & { summary: string; etag: string; sendUpdates: "all" }) => Promise<unknown>
}

/** Private operator output. Never log, publish, or expose through a public route. */
export type CoachingTitleBackfillEntry = {
  bookingId: string
  googleEventId: string | null
  previousTitle?: string
  proposedTitle?: string
  etag?: string
  protectedDigestBefore?: string
  protectedDigestAfter?: string
  verification?: "verified" | "failed" | "unverified"
  result: "ready" | "updated" | "skipped" | "failed" | "verification_failed"
  reason?: string
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}

function protectedFields(event: GoogleCoachingTitleEvent) {
  const fields = Object.fromEntries(Object.entries(event)
    .filter(([key]) => !["summary", "etag", "updated", "sequence"].includes(key)))
  const conference = event.conferenceData as {
    createRequest?: { status?: { statusCode?: string } }
    conferenceId?: unknown
    entryPoints?: unknown
  } | null | undefined
  // Google may discard completed creation-request metadata on an unrelated edit.
  // Keep the full established conference, including its signature and entry points,
  // and keep every pending, failed, or unrecognized creation request protected.
  if (conference?.createRequest?.status?.statusCode === "success"
    && typeof conference.conferenceId === "string" && conference.conferenceId.trim().length > 0
    && Array.isArray(conference.entryPoints) && conference.entryPoints.length > 0
    && conference.entryPoints.every((entry) => entry && typeof entry.entryPointType === "string"
      && entry.entryPointType.trim().length > 0 && typeof entry.uri === "string" && entry.uri.trim().length > 0)) {
    fields.conferenceData = Object.fromEntries(Object.entries(conference)
      .filter(([key]) => key !== "createRequest"))
  }
  return fields
}

function eligibilityReason(booking: CoachingTitleBackfillBooking, event: GoogleCoachingTitleEvent) {
  if (event.recurringEventId || event.recurrence) return "recurring_event_identity_ambiguous"
  if (event.id !== booking.google_event_id) return "event_identity_mismatch"
  if (event.status !== "confirmed") return "event_not_confirmed"
  if (event.organizer?.self !== true || !event.organizer.email) return "organizer_access_unverified"
  if (!event.etag) return "missing_etag"
  if (Date.parse(event.start?.dateTime ?? "") !== Date.parse(booking.starts_at)
    || Date.parse(event.end?.dateTime ?? "") !== Date.parse(booking.ends_at)) return "calendar_time_drift"
  if (event.summary !== `Coach House meeting with ${COACHING_JOINT_COACH_LABEL}`) return "custom_or_already_updated_title"
  return null
}

/**
 * Dry-run by default. Applying requires the exact ready entries from a reviewed dry-run.
 * No event is recreated; unavailable or ambiguous events are skipped, never guessed.
 */
export async function backfillCoachingCalendarTitles({
  bookings, ports, now = new Date(), apply = false, approvedEntries = [], onProgress,
}: {
  bookings: CoachingTitleBackfillBooking[]
  ports: CoachingTitleBackfillPorts
  now?: Date
  apply?: boolean
  approvedEntries?: CoachingTitleBackfillEntry[]
  onProgress?: (entries: CoachingTitleBackfillEntry[]) => Promise<void>
}) {
  const eventCounts = new Map<string, number>()
  for (const booking of bookings) {
    if (booking.google_event_id) eventCounts.set(booking.google_event_id, (eventCounts.get(booking.google_event_id) ?? 0) + 1)
  }
  const entries: CoachingTitleBackfillEntry[] = []
  for (const booking of bookings) {
    const entry: CoachingTitleBackfillEntry = { bookingId: booking.id, googleEventId: booking.google_event_id, result: "skipped" }
    entries.push(entry)
    try {
      if (booking.status !== "confirmed" || !(Date.parse(booking.starts_at) > now.getTime())) {
        entry.reason = "not_upcoming_confirmed"; continue
      }
      if (!["joel", "paula"].includes(booking.coach_id)) { entry.reason = "unknown_coach"; continue }
      if (booking.calendar_pending_action) { entry.reason = "calendar_change_pending"; continue }
      if (!booking.google_event_id) { entry.reason = "missing_event_id"; continue }
      if (eventCounts.get(booking.google_event_id) !== 1) { entry.reason = "ambiguous_event_id"; continue }
      let writeAttempted = false
      try {
        const clientName = normalizeCoachingClientName(await ports.loadClientName(booking.user_id))
        if (!clientName) { entry.reason = "missing_client_name"; continue }
        const key = { coachId: normalizeCoachId(booking.coach_id), googleEventId: booking.google_event_id }
        const event = await ports.readEvent(key)
        const reason = eligibilityReason(booking, event)
        if (reason) { entry.reason = reason; continue }
        const before = stableJson(protectedFields(event))
        entry.protectedDigestBefore = createHash("sha256").update(before).digest("hex")
        Object.assign(entry, { previousTitle: event.summary, proposedTitle: buildCoachingCalendarTitle(clientName), etag: event.etag })
        if (!apply) { entry.result = "ready"; continue }
        const approved = approvedEntries.filter((candidate) => candidate.result === "ready"
          && candidate.bookingId === entry.bookingId && candidate.googleEventId === entry.googleEventId
          && candidate.etag === entry.etag && candidate.previousTitle === entry.previousTitle
          && candidate.proposedTitle === entry.proposedTitle
          && candidate.protectedDigestBefore === entry.protectedDigestBefore)
        if (approved.length !== 1) { entry.reason = "unapproved_or_changed_since_dry_run"; continue }
        entry.verification = "unverified"
        await onProgress?.(entries)
        writeAttempted = true
        await ports.updateTitle({ ...key, summary: entry.proposedTitle!, etag: event.etag, sendUpdates: "all" })
        const after = await ports.readEvent(key)
        entry.protectedDigestAfter = createHash("sha256").update(stableJson(protectedFields(after))).digest("hex")
        if (after.summary !== entry.proposedTitle || stableJson(protectedFields(after)) !== before) {
          entry.verification = "failed"
          entry.result = "verification_failed"; entry.reason = "event_readback_mismatch"
          // Stop rather than compound an unexpected mutation or overwrite a concurrent change.
          break
        }
        entry.verification = "verified"
        entry.result = "updated"
      } catch (error) {
        entry.result = "failed"
        entry.reason = (error as { status?: number }).status === 412 ? "concurrent_event_change"
          : writeAttempted ? "calendar_write_outcome_unverified" : "calendar_or_identity_unavailable"
        // A timed-out write may have succeeded. Require a new dry-run before any retry.
        if (apply) break
      }
    } finally { await onProgress?.(entries) }
  }
  return {
    mode: apply ? "apply" as const : "dry_run" as const, entries,
    totalBookings: bookings.length, remaining: bookings.length - entries.length,
  }
}

/** Explicitly invoked operator helper; never runs from page loads or reconciliation. */
export async function runUpcomingCoachingTitleBackfill({
  admin, apply = false, approvedEntries = [], now = new Date(), limit = 100, onProgress,
}: {
  admin: SupabaseClient<Database>
  apply?: boolean
  approvedEntries?: CoachingTitleBackfillEntry[]
  now?: Date
  limit?: number
  onProgress?: (entries: CoachingTitleBackfillEntry[]) => Promise<void>
}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Backfill limit must be between 1 and 500.")
  const { data, error } = await admin.from("coaching_bookings")
    .select("id, user_id, coach_id, status, starts_at, ends_at, google_event_id, calendar_pending_action")
    .eq("status", "confirmed").gt("starts_at", now.toISOString())
    .order("starts_at", { ascending: true }).limit(limit + 1)
  if (error) throw new Error("Unable to load upcoming coaching bookings.")
  if ((data?.length ?? 0) > limit) throw new Error("Upcoming bookings exceed the backfill limit; increase the bounded limit before review.")
  return backfillCoachingCalendarTitles({
    bookings: data ?? [], apply, approvedEntries, now, onProgress,
    ports: {
      loadClientName: (userId) => loadCoachingClientName({ supabase: admin, userId }),
      readEvent: readGoogleCoachingEventForTitle,
      updateTitle: updateGoogleCoachingEventTitle,
    },
  })
}
