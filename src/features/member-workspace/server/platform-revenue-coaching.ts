import type Stripe from "stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createRevenueChargeResolver } from "./platform-revenue-sources"

export function createCoachingPaymentMatcher(stripe: Stripe, resolveCharge = createRevenueChargeResolver(stripe)) {
  const coaches = new Map<string, Promise<string | null>>()
  return async (transaction: Stripe.BalanceTransaction, coach: string) => {
    const charge = await resolveCharge(transaction)
    if (!coaches.has(charge.id)) coaches.set(charge.id, (async () => {
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
      if (!intent) return null
      for await (const session of stripe.checkout.sessions.list({ payment_intent: intent, limit: 100 })) {
        if (session.metadata?.kind !== "coaching_booking") continue
        const bookingId = session.metadata.booking_id
        if (!bookingId) throw new Error("Missing coaching booking")
        const { data, error } = await createSupabaseAdminClient().from("coaching_bookings")
          .select("coach_id").eq("id", bookingId).maybeSingle()
        if (error || !data) throw new Error("Unable to verify booking coach")
        return data.coach_id
      }
      return null
    })())
    const assignedCoach = await coaches.get(charge.id)
    return assignedCoach != null && (coach === "all" || assignedCoach === coach)
  }
}
