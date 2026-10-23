import type { SupabaseClient } from "@supabase/supabase-js"

import { createNotification } from "@/lib/notifications"
import type { Database } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { trackUserJourneyMilestone } from "@/lib/user-journey"
import {
  COACHING_JOINT_COACH_IDS,
  COACHING_JOINT_COACH_LABEL,
  getValidGoogleCalendarEventId,
  getValidGoogleCalendarEventUrl,
  getValidGoogleMeetUrl,
  normalizeCoachId,
  normalizePriceTier,
} from "../lib"
import type { CoachingCoachId } from "../types"
import { buildCoachingCalendarTitle } from "../lib/calendar-title"
import { isCoachingSlotWithinSchedule } from "../lib/availability"
import { isCoachingSlotUnavailable, COACHING_SLOT_UNAVAILABLE_MESSAGE } from "../lib/booking-errors"
import { loadCoachingClientName } from "./coaching-client-name"
import { assertCoachingCalendarAvailable } from "./calendar-conflicts"
import { sendCoachingBookingConfirmationEmails } from "./email"
import {
  createGoogleCoachingEvent,
  deleteGoogleCoachingEvent,
  getGoogleCoachingParticipantEmail,
} from "./google-calendar"

type AdminClient = SupabaseClient<Database>

type BookingForConfirmation = {
  id: string
  org_id: string
  user_id: string
  coach_id: string
  status: string
  price_tier: string
  starts_at: string
  ends_at: string
  timezone: string
  attendee_notes: string | null
  google_event_id: string | null
  google_meet_url: string | null
  calendar_pending_action?: string | null
  stripe_checkout_session_id?: string | null
  cancel_reason?: string | null
}

async function rejectUnavailableBooking(admin: AdminClient, booking: BookingForConfirmation) {
  const result = await admin.from("coaching_bookings").update({
    status: "canceled",
    canceled_at: new Date().toISOString(),
    cancel_reason: COACHING_SLOT_UNAVAILABLE_MESSAGE,
    hold_expires_at: null,
  }).eq("id", booking.id).in("status", ["held", "pending_payment"])
    .select("id").maybeSingle()
  if (result.error) throw supabaseErrorToError(result.error, "Unable to release the unavailable coaching slot.")
  // A concurrent successful confirmation must not be canceled by a stale caller.
  const current = await loadCoachingBookingForConfirmation({ admin, bookingId: booking.id })
  if (!current) throw new Error("Unable to reload coaching booking.")
  return current
}

function buildCalendarEventDescription(booking: BookingForConfirmation) {
  const notes = booking.attendee_notes?.trim()
  const base = `Coach House coaching meeting with ${COACHING_JOINT_COACH_LABEL} booked inside the platform.`
  return notes ? `${base}\n\nMeeting notes from attendee:\n${notes}` : base
}

export async function confirmCoachingBooking({
  admin,
  booking,
  attendeeEmail,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  stripeCustomerId,
}: {
  admin: AdminClient
  booking: BookingForConfirmation
  attendeeEmail: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  stripeCustomerId?: string | null
}) {
  if (booking.status === "confirmed" && booking.google_event_id && booking.calendar_pending_action !== "create") {
    return booking
  }

  if (booking.status === "canceled") return booking
  if (booking.status !== "confirmed" && !isCoachingSlotWithinSchedule(new Date(booking.starts_at), new Date(booking.ends_at))) {
    return rejectUnavailableBooking(admin, booking)
  }
  try {
    await assertCoachingCalendarAvailable({
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      excludeGoogleEventId: booking.google_event_id ?? booking.id.replaceAll("-", ""),
    })
  } catch (error) {
    if (!isCoachingSlotUnavailable(error) || booking.status === "confirmed") throw error
    return rejectUnavailableBooking(admin, booking)
  }
  const attendeeName = await loadCoachingClientName({ supabase: admin, userId: booking.user_id })

  const creditResult = await admin.rpc("confirm_coaching_credit_booking", {
    p_booking_id: booking.id,
    p_checkout_id: stripeCheckoutSessionId ?? null,
    p_payment_id: stripePaymentIntentId ?? null,
    p_customer_id: stripeCustomerId ?? null,
  })
  if (creditResult.error) {
    if (isCoachingSlotUnavailable(creditResult.error)) return rejectUnavailableBooking(admin, booking)
    throw supabaseErrorToError(creditResult.error, "Unable to reserve coaching credit.")
  }

  const coachId = normalizeCoachId(booking.coach_id)
  const priceTier = normalizePriceTier(booking.price_tier)
  const internalAttendeeEmails = COACHING_JOINT_COACH_IDS.filter((participantId) => participantId !== coachId)
    .map((participantId) => getGoogleCoachingParticipantEmail(participantId))
    .filter((email): email is string => Boolean(email))
  const calendarEvent = await createGoogleCoachingEvent({
    eventId: booking.id.replaceAll("-", ""),
    coachId,
    summary: buildCoachingCalendarTitle(attendeeName),
    description: buildCalendarEventDescription(booking),
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    timezone: booking.timezone,
    attendeeEmail,
    internalAttendeeEmails,
  }).catch((error: unknown) => {
    // The confirmed reservation and durable Calendar create action are retried by reconciliation.
    console.error("Coaching calendar confirmation pending", error)
    return null
  })
  if (!calendarEvent) {
    const current = await loadCoachingBookingForConfirmation({ admin, bookingId: booking.id })
    if (!current) throw new Error("Unable to reload coaching booking.")
    return current
  }

  const googleEventId = getValidGoogleCalendarEventId(calendarEvent.googleEventId)
  const googleMeetUrl = getValidGoogleMeetUrl(calendarEvent.googleMeetUrl)
  const googleEventHtmlLink = getValidGoogleCalendarEventUrl(calendarEvent.googleEventHtmlLink)

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("coaching_bookings")
    .update({
      status: "confirmed",
      confirmed_at: now,
      hold_expires_at: null,
      stripe_checkout_session_id: stripeCheckoutSessionId ?? undefined,
      stripe_payment_intent_id: stripePaymentIntentId ?? undefined,
      stripe_customer_id: stripeCustomerId ?? undefined,
      calendar_pending_action: null,
      google_event_id: googleEventId,
      google_event_html_link: googleEventHtmlLink,
      google_meet_url: googleMeetUrl,
    })
    .eq("id", booking.id)
    .eq("status", "confirmed")
    .eq("calendar_pending_action", "create")
    .select(
      "id, org_id, user_id, coach_id, status, price_tier, starts_at, ends_at, timezone, google_event_id, google_meet_url"
    )
    .maybeSingle<BookingForConfirmation>()

  if (error) {
    throw supabaseErrorToError(error, "Unable to confirm coaching booking.")
  }

  if (!updated) {
    const current = await loadCoachingBookingForConfirmation({
      admin,
      bookingId: booking.id,
    })
    if (current?.status === "canceled" && googleEventId) await deleteGoogleCoachingEvent({ coachId, googleEventId })
    return current ?? booking
  }

  const notifyResult = await createNotification(admin as never, {
    userId: booking.user_id,
    orgId: booking.org_id,
    title: "Coaching meeting confirmed",
    description: googleMeetUrl
      ? "Your Coach House meeting is booked. The Meet link is ready in Coaching."
      : "Your Coach House meeting is booked. The Meet link will appear in Coaching when ready.",
    href: "/coaching",
    tone: "success",
    type: "coaching_booking_confirmed",
    actorId: booking.user_id,
    metadata: {
      bookingId: booking.id,
      coachId,
      startsAt: booking.starts_at,
      priceTier,
    },
  })
  if ("error" in notifyResult) {
    console.error("Failed to create coaching confirmation notification", notifyResult.error)
  }

  try {
    await sendCoachingBookingConfirmationEmails({
      attendeeName,
      attendeeEmail,
      coachEmails: COACHING_JOINT_COACH_IDS.map((participantId) =>
        getGoogleCoachingParticipantEmail(participantId)
      ).filter((email): email is string => Boolean(email)),
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      timezone: booking.timezone,
      googleEventHtmlLink,
      googleMeetUrl,
      attendeeNotes: booking.attendee_notes,
      bookingId: booking.id,
    })
  } catch (emailError) {
    console.error("Failed to send coaching booking confirmation email", emailError)
  }

  await trackUserJourneyMilestone({
    userId: booking.user_id,
    orgId: booking.org_id,
    eventName: "coaching_schedule_opened",
    journey: "coaching",
    source: "coaching_booking",
    surface: "coaching",
    checkpoint: "first_coaching_schedule_opened",
    metadata: {
      bookingId: booking.id,
      coachId,
      startsAt: booking.starts_at,
      priceTier,
      hasMeetLink: Boolean(googleMeetUrl),
    },
  })

  return updated
}

export async function loadCoachingBookingForConfirmation({
  admin,
  bookingId,
}: {
  admin: AdminClient
  bookingId: string
}) {
  const { data, error } = await admin
    .from("coaching_bookings")
    .select(
      "id, org_id, user_id, coach_id, status, price_tier, starts_at, ends_at, timezone, attendee_notes, google_event_id, google_meet_url, calendar_pending_action, stripe_checkout_session_id, cancel_reason"
    )
    .eq("id", bookingId)
    .maybeSingle<BookingForConfirmation>()

  if (error) {
    throw supabaseErrorToError(error, "Unable to load coaching booking.")
  }

  return data
}

export async function restoreBookingCredit({
  admin,
  booking,
}: {
  admin: AdminClient
  booking: BookingForConfirmation
}) {
  const { error } = await admin.rpc("restore_coaching_credit", {
    p_booking_id: booking.id,
    p_actor_id: null,
    p_reason: "Coaching credit restored after cancellation.",
  })
  if (error) throw supabaseErrorToError(error, "Unable to restore coaching credit.")
}

export function resolveCoachDisplayName(_coachId: CoachingCoachId) {
  return COACHING_JOINT_COACH_LABEL
}
