"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  resolveStripePriceIdForCoaching,
  resolveStripeRuntimeConfigForCoaching,
} from "@/lib/billing/stripe-runtime"
import { env } from "@/lib/env"
import {
  resolveDevtoolsAudience,
  resolveTesterMetadata,
} from "@/lib/devtools/audience"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { createNotification } from "@/lib/notifications"
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { trackUserJourneyMilestone } from "@/lib/user-journey"
import {
  addMinutes,
  COACHING_DEFAULT_TIMEZONE,
  COACHING_HOLD_MINUTES,
  COACHING_JOINT_COACH_IDS,
  COACHING_JOINT_PRIMARY_COACH_ID,
  COACHING_PATH,
  COACHING_SESSION_MINUTES,
  isValidFutureDate,
  normalizeCoachId,
} from "../lib"
import { buildCandidateSlots } from "../lib/availability"
import { COACHING_SLOT_UNAVAILABLE, COACHING_SLOT_UNAVAILABLE_MESSAGE, isCoachingSlotUnavailable } from "../lib/booking-errors"
import { COACHING_ATTENDEE_NOTES_MAX_LENGTH } from "../types"
import type {
  CoachingActionResult,
  CoachingAvailabilityInput,
  CoachingBookingInput,
  CoachingManageBookingInput,
  CoachingSlot,
} from "../types"
import {
  confirmCoachingBooking,
  loadCoachingBookingForConfirmation,
} from "./booking-finalizer"
import { flushCoachingCalendarChange } from "./calendar-reconciliation"
import { listLocalBusyWindows, resolveCoachingCreditSummary } from "./data"
import {
  isGoogleCoachingConfigured,
  listGoogleBusyWindows,
} from "./google-calendar"

type AuthContext = {
  userId: string
  userEmail: string | null
  orgId: string
}

async function getAppOrigin() {
  const requestHeaders = await headers()
  const requestOrigin = requestHeaders.get("origin")
  if (requestOrigin) return requestOrigin

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  if (host) {
    const protocol =
      requestHeaders.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https")
    return `${protocol}://${host}`
  }

  return (
    env.NEXT_PUBLIC_SITE_URL ??
    env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  )
}

async function resolveActionContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw supabaseErrorToError(error, "Unable to load authenticated user.")
  }
  if (!user) {
    throw new Error("Sign in to book coaching.")
  }

  const activeOrg = await resolveActiveOrganization(supabase, user.id)
  return {
    userId: user.id,
    userEmail: user.email ?? null,
    orgId: activeOrg.orgId,
  }
}

function parseRange(input: CoachingAvailabilityInput) {
  const coachId = normalizeCoachId(input.coachId)
  const from = new Date(input.from)
  const to = new Date(input.to)
  const timezone = input.timezone || COACHING_DEFAULT_TIMEZONE
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  ) {
    throw new Error("Choose a valid date range.")
  }
  return { coachId, from, to, timezone }
}

function normalizeAttendeeNotes(value: string | undefined) {
  const notes = value?.trim() ?? ""
  if (notes.length > COACHING_ATTENDEE_NOTES_MAX_LENGTH) {
    throw new Error(
      `Keep notes under ${COACHING_ATTENDEE_NOTES_MAX_LENGTH} characters.`
    )
  }
  return notes.length > 0 ? notes : null
}

function hasOverlap({
  startsAt,
  endsAt,
  windows,
}: {
  startsAt: Date
  endsAt: Date
  windows: Array<{ startsAt: string; endsAt: string }>
}) {
  return windows.some((window) => {
    const busyStart = new Date(window.startsAt)
    const busyEnd = new Date(window.endsAt)
    return startsAt < busyEnd && busyStart < endsAt
  })
}

async function listJointBusyWindows({
  from,
  to,
  excludeBookingId,
  excludeGoogleEventId,
}: {
  from: string
  to: string
  excludeBookingId?: string
  excludeGoogleEventId?: string
}) {
  const admin = createSupabaseAdminClient()
  const windows = await Promise.all([
    ...COACHING_JOINT_COACH_IDS.map((coachId) =>
      listLocalBusyWindows({ supabase: admin, coachId, from, to, excludeBookingId })
    ),
    ...COACHING_JOINT_COACH_IDS.map((coachId) =>
      listGoogleBusyWindows({ coachId, timeMin: from, timeMax: to, excludeGoogleEventId })
    ),
  ])
  return windows.flat()
}

async function createStripeCheckout({
  bookingId,
  userId,
  userEmail,
  orgId,
  priceTier,
}: {
  bookingId: string
  userId: string
  userEmail: string | null
  orgId: string
  priceTier: "discounted" | "full"
}) {
  const supabase = await createSupabaseServerClient()
  const audience = await resolveDevtoolsAudience({
    supabase,
    userId,
    fallbackIsTester: resolveTesterMetadata({}),
  })
  const config = resolveStripeRuntimeConfigForCoaching({
    useTesterRuntime: audience.isAdmin,
    priceTier,
  })
  if (!config) {
    throw new Error("Stripe is not configured for coaching checkout.")
  }

  const priceId = resolveStripePriceIdForCoaching({ config, priceTier })
  if (!priceId) {
    throw new Error("Coaching price is not configured.")
  }

  const origin = await getAppOrigin()
  const checkout = await config.client.checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId,
    customer_email: userEmail ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      kind: "coaching_booking",
      booking_id: bookingId,
      user_id: userId,
      org_user_id: orgId,
      price_tier: priceTier,
      stripe_mode: config.mode,
    },
    success_url: `${origin}${COACHING_PATH}?checkout=success&booking=${bookingId}`,
    cancel_url: `${origin}${COACHING_PATH}?checkout=cancelled&booking=${bookingId}`,
  })

  if (!checkout.url) {
    throw new Error("Stripe did not return a checkout URL.")
  }

  return { checkoutUrl: checkout.url, checkoutSessionId: checkout.id }
}

export async function listCoachingAvailabilityAction(
  input: CoachingAvailabilityInput
): Promise<
  CoachingActionResult<{ slots: CoachingSlot[]; calendarConfigured: boolean }>
> {
  try {
    const { from, to, timezone } = parseRange(input)
    if (!isGoogleCoachingConfigured()) {
      return { ok: true, slots: [], calendarConfigured: false }
    }

    const busyWindows = await listJointBusyWindows({
      from: from.toISOString(),
      to: to.toISOString(),
    })
    const slots = buildCandidateSlots({
      coachId: COACHING_JOINT_PRIMARY_COACH_ID,
      from,
      to,
      timezone,
      busyWindows,
    }).filter((slot) => slot.available)

    return { ok: true, slots, calendarConfigured: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load coaching availability.",
    }
  }
}

export async function reserveCoachingBookingAction(
  input: CoachingBookingInput
): Promise<
  CoachingActionResult<{
    bookingId: string
    checkoutUrl?: string
    confirmed: boolean
  }>
> {
  try {
    normalizeCoachId(input.coachId)
    const coachId = COACHING_JOINT_PRIMARY_COACH_ID
    const startsAt = new Date(input.startsAt)
    if (!isValidFutureDate(input.startsAt)) {
      return { ok: false, error: "Choose a future coaching slot." }
    }
    if (!isGoogleCoachingConfigured()) {
      return { ok: false, error: "Coach calendar is not connected yet." }
    }

    const context = await resolveActionContext()

    const endsAt = addMinutes(startsAt, COACHING_SESSION_MINUTES)
    const attendeeNotes = normalizeAttendeeNotes(input.attendeeNotes)
    const busyWindows = await listJointBusyWindows({
      from: startsAt.toISOString(),
      to: endsAt.toISOString(),
    })
    if (hasOverlap({ startsAt, endsAt, windows: busyWindows })) {
      return {
        ok: false,
        error: COACHING_SLOT_UNAVAILABLE_MESSAGE,
        code: COACHING_SLOT_UNAVAILABLE,
      }
    }

    const admin = createSupabaseAdminClient()
    const creditSummary = await resolveCoachingCreditSummary({
      supabase: admin,
      userId: context.userId,
      orgId: context.orgId,
    })
    const priceTier = creditSummary.priceTier
    const status = priceTier === "included" ? "held" : "pending_payment"
    const holdExpiresAt = addMinutes(
      new Date(),
      COACHING_HOLD_MINUTES
    ).toISOString()

    const { data: booking, error } = await admin
      .from("coaching_bookings")
      .insert({
        org_id: context.orgId,
        user_id: context.userId,
        coach_id: coachId,
        status,
        price_tier: priceTier,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: input.timezone || COACHING_DEFAULT_TIMEZONE,
        attendee_notes: attendeeNotes,
        hold_expires_at: holdExpiresAt,
      })
      .select(
        "id, org_id, user_id, coach_id, status, price_tier, starts_at, ends_at, timezone, attendee_notes, google_event_id, google_meet_url"
      )
      .single()

    if (error) {
      if (isCoachingSlotUnavailable(error)) return { ok: false, error: COACHING_SLOT_UNAVAILABLE_MESSAGE, code: COACHING_SLOT_UNAVAILABLE }
      throw supabaseErrorToError(error, "Unable to reserve coaching booking.")
    }

    if (priceTier === "included") {
      try {
        const confirmed = await confirmCoachingBooking({
          admin,
          booking,
          attendeeEmail: context.userEmail,
        })
        if (confirmed.status !== "confirmed") return { ok: false, error: COACHING_SLOT_UNAVAILABLE_MESSAGE, code: COACHING_SLOT_UNAVAILABLE }
      } catch (confirmError) {
        await admin
          .from("coaching_bookings")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            cancel_reason: "Unable to create the coach calendar event.",
          })
          .eq("id", booking.id)
          .eq("status", "held")
        throw confirmError
      }
      revalidatePath(COACHING_PATH)
      return { ok: true, bookingId: booking.id, confirmed: true }
    }

    const checkout = await createStripeCheckout({
      bookingId: booking.id,
      userId: context.userId,
      userEmail: context.userEmail,
      orgId: context.orgId,
      priceTier,
    })

    const { error: checkoutUpdateError } = await admin
      .from("coaching_bookings")
      .update({ stripe_checkout_session_id: checkout.checkoutSessionId })
      .eq("id", booking.id)

    if (checkoutUpdateError) {
      throw supabaseErrorToError(
        checkoutUpdateError,
        "Unable to attach coaching checkout."
      )
    }

    await trackUserJourneyMilestone({
      userId: context.userId,
      orgId: context.orgId,
      eventName: "checkout_started",
      journey: "coaching",
      source: "coaching_booking",
      surface: "coaching",
      checkpoint: "checkout_started",
      metadata: {
        bookingId: booking.id,
        coachId,
        startsAt: booking.starts_at,
        priceTier,
      },
    })

    revalidatePath(COACHING_PATH)
    return {
      ok: true,
      bookingId: booking.id,
      checkoutUrl: checkout.checkoutUrl,
      confirmed: false,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unable to book coaching.",
      ...(isCoachingSlotUnavailable(error) ? { code: COACHING_SLOT_UNAVAILABLE } : {}),
    }
  }
}

export async function cancelCoachingBookingAction(
  input: CoachingManageBookingInput
): Promise<CoachingActionResult<{ success: true; creditRestored?: boolean }>> {
  try {
    const context = await resolveActionContext()
    const admin = createSupabaseAdminClient()
    const booking = await loadCoachingBookingForConfirmation({
      admin,
      bookingId: input.bookingId,
    })

    if (!booking || booking.user_id !== context.userId) {
      return { ok: false, error: "Coaching booking not found." }
    }
    if (Date.parse(booking.starts_at) <= Date.now()) {
      return {
        ok: false,
        error: "Past coaching meetings cannot be canceled here.",
      }
    }

    const canceled = await admin.rpc("manage_coaching_credit_booking", {
      p_booking_id: booking.id,
      p_actor_id: context.userId,
      p_action: "cancel",
      p_staff: false,
      p_reason: input.reason?.trim() || null,
    })
    if (canceled.error)
      throw supabaseErrorToError(
        canceled.error,
        "Unable to cancel coaching booking."
      )
    const creditRestored =
      (canceled.data as { creditRestored?: boolean }).creditRestored === true
    await flushCoachingCalendarChange(booking.id).catch(() => undefined)

    const notifyResult = await createNotification(admin as never, {
      userId: booking.user_id,
      orgId: booking.org_id,
      title: "Coaching meeting canceled",
      description: creditRestored
        ? "Your coaching credit was restored to its original grant."
        : "Canceled with less than 4 hours notice. Your credit remains used.",
      href: COACHING_PATH,
      tone: "info",
      type: "coaching_booking_canceled",
      actorId: booking.user_id,
      metadata: { bookingId: booking.id },
    })
    if ("error" in notifyResult) {
      console.error(
        "Failed to create coaching cancellation notification",
        notifyResult.error
      )
    }

    revalidatePath(COACHING_PATH)
    return { ok: true, success: true, creditRestored }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unable to cancel coaching.",
    }
  }
}

export async function rescheduleCoachingBookingAction(
  input: CoachingManageBookingInput & { startsAt: string; timezone: string }
): Promise<CoachingActionResult<{ success: true }>> {
  try {
    const context = await resolveActionContext()
    const admin = createSupabaseAdminClient()
    const booking = await loadCoachingBookingForConfirmation({
      admin,
      bookingId: input.bookingId,
    })

    if (!booking || booking.user_id !== context.userId) {
      return { ok: false, error: "Coaching booking not found." }
    }
    if (Date.parse(booking.starts_at) <= Date.now()) {
      return {
        ok: false,
        error: "Past coaching meetings cannot be rescheduled here.",
      }
    }
    if (!isValidFutureDate(input.startsAt)) {
      return { ok: false, error: "Choose a future coaching slot." }
    }

    const startsAt = new Date(input.startsAt)
    const endsAt = addMinutes(startsAt, COACHING_SESSION_MINUTES)
    const busyWindows = await listJointBusyWindows({
      from: startsAt.toISOString(),
      to: endsAt.toISOString(),
      excludeBookingId: booking.id,
      excludeGoogleEventId: booking.google_event_id ?? undefined,
    })
    if (hasOverlap({ startsAt, endsAt, windows: busyWindows })) {
      return {
        ok: false,
        error: COACHING_SLOT_UNAVAILABLE_MESSAGE,
        code: COACHING_SLOT_UNAVAILABLE,
      }
    }

    if (!input.requestId)
      return { ok: false, error: "Refresh before rescheduling this meeting." }
    const moved = await admin.rpc("manage_coaching_credit_booking", {
      p_booking_id: booking.id,
      p_actor_id: context.userId,
      p_action: "reschedule",
      p_staff: false,
      p_reason: input.reason?.trim() || null,
      p_starts_at: startsAt.toISOString(),
      p_timezone: input.timezone || booking.timezone,
      p_request_id: input.requestId,
      p_expected_starts_at: booking.starts_at,
    })
    if (moved.error)
      throw supabaseErrorToError(
        moved.error,
        "Unable to reschedule coaching booking."
      )
    await flushCoachingCalendarChange(booking.id).catch(() => undefined)

    revalidatePath(COACHING_PATH)
    return { ok: true, success: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to reschedule coaching.",
    }
  }
}
