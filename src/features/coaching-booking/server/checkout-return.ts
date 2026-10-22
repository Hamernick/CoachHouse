import { recordPurchasedCoachingCredit } from "./purchased-credit"
import type Stripe from "stripe"

import { resolveStripeRuntimeConfigsForFallback } from "@/lib/billing/stripe-runtime"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import { confirmCoachingBooking } from "./booking-finalizer"

type PaidCheckoutBooking = {
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
  stripe_checkout_session_id: string | null
  cancel_reason?: string | null
}

function shouldTryNextStripeRuntime(error: unknown) {
  const stripeError = error as Stripe.errors.StripeError | null
  return (
    stripeError?.type === "StripeInvalidRequestError" &&
    stripeError.code === "resource_missing"
  )
}

async function retrieveCheckoutSession(sessionId: string) {
  const preferTester =
    sessionId.startsWith("cs_test_") || process.env.NODE_ENV !== "production"
  const configs = resolveStripeRuntimeConfigsForFallback({ preferTester })
  let lastMissingError: unknown = null

  for (const config of configs) {
    try {
      return await config.client.checkout.sessions.retrieve(sessionId)
    } catch (error) {
      if (!shouldTryNextStripeRuntime(error)) throw error
      lastMissingError = error
    }
  }

  if (lastMissingError) throw lastMissingError
  return null
}

function checkoutSessionIsPaidForBooking({
  session,
  bookingId,
}: {
  session: Stripe.Checkout.Session
  bookingId: string
}) {
  if (session.mode !== "payment") return false
  if (session.metadata?.kind !== "coaching_booking") return false
  if (session.metadata.booking_id !== bookingId) return false
  return session.payment_status === "paid"
}

export async function confirmPaidCoachingCheckoutReturn({
  bookingId,
  userId,
  orgId,
  userEmail,
}: {
  bookingId: string
  userId: string
  orgId: string
  userEmail: string | null
}) {
  const admin = createSupabaseAdminClient()
  const { data: booking, error } = await admin
    .from("coaching_bookings")
    .select(
      "id, org_id, user_id, coach_id, status, price_tier, starts_at, ends_at, timezone, attendee_notes, google_event_id, google_meet_url, stripe_checkout_session_id, calendar_pending_action, cancel_reason"
    )
    .eq("id", bookingId)
    .maybeSingle<PaidCheckoutBooking>()

  if (error) {
    throw supabaseErrorToError(
      error,
      "Unable to load coaching checkout return."
    )
  }
  if (!booking || booking.user_id !== userId || booking.org_id !== orgId) {
    return { confirmed: false }
  }
  if (booking.status === "canceled") {
    return { confirmed: false, slotUnavailable: booking.cancel_reason?.startsWith("That slot was just taken") === true }
  }
  if (
    booking.status === "confirmed" &&
    booking.google_event_id &&
    booking.calendar_pending_action !== "create"
  ) {
    return { confirmed: true }
  }
  if (booking.status === "confirmed") {
    const current = await confirmCoachingBooking({
      admin,
      booking,
      attendeeEmail: userEmail,
    })
    return { confirmed: current.status === "confirmed", slotUnavailable: current.status === "canceled" && current.cancel_reason?.startsWith("That slot was just taken") === true }
  }
  if (
    booking.status !== "pending_payment" ||
    !booking.stripe_checkout_session_id
  ) {
    return { confirmed: false }
  }

  const session = await retrieveCheckoutSession(
    booking.stripe_checkout_session_id
  )
  if (
    !session ||
    !checkoutSessionIsPaidForBooking({ session, bookingId: booking.id })
  ) {
    return { confirmed: false }
  }

  await recordPurchasedCoachingCredit({
    admin,
    booking,
    checkoutId: session.id,
  })
  const confirmed = await confirmCoachingBooking({
    admin,
    booking,
    attendeeEmail: userEmail,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : null,
  })

  return { confirmed: confirmed.status === "confirmed", slotUnavailable: confirmed.status === "canceled" && confirmed.cancel_reason?.startsWith("That slot was just taken") === true }
}
