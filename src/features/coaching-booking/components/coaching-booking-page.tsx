import { redirect } from "next/navigation"
import { hasCoachCoachingAccess } from "@/features/platform-access"

import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { COACHING_PATH } from "../lib"
import {
  cancelPendingCoachingCheckoutReturn,
  confirmPaidCoachingCheckoutReturn,
  loadCoachingBookingPageData,
} from "../loaders"
import { CoachingBookingFlow } from "./coaching-booking-flow"

type CoachingBookingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export async function CoachingBookingPage({ searchParams }: CoachingBookingPageProps = {}) {
  const context = await resolveOptionalAuthenticatedAppContext()
  const checkout = getFirstParam(searchParams?.checkout)
  const bookingId = getFirstParam(searchParams?.booking)

  if (!context) {
    redirect("/login?redirect=/coaching")
  }

  if (
    context.profileAudience.platformAccessLevel === "coach" &&
    !hasCoachCoachingAccess(context.user.app_metadata)
  ) {
    redirect("/organizations")
  }

  if (checkout === "cancelled" && bookingId) {
    const result = await confirmPaidCoachingCheckoutReturn({
      bookingId,
      userId: context.user.id,
      orgId: context.activeOrg.orgId,
      userEmail: context.user.email ?? null,
    })
    if (!result.confirmed) {
      await cancelPendingCoachingCheckoutReturn({
        bookingId,
        userId: context.user.id,
        orgId: context.activeOrg.orgId,
      })
    }
    redirect(COACHING_PATH)
  }

  if (checkout === "success" && bookingId) {
    const result = await confirmPaidCoachingCheckoutReturn({
      bookingId,
      userId: context.user.id,
      orgId: context.activeOrg.orgId,
      userEmail: context.user.email ?? null,
    })
    if (result.slotUnavailable) redirect(`${COACHING_PATH}?checkout=unavailable`)
    redirect(COACHING_PATH)
  }

  const data = await loadCoachingBookingPageData({
    supabase: context.supabase,
    userId: context.user.id,
    orgId: context.activeOrg.orgId,
    userEmail: context.user.email ?? null,
  })

  return <CoachingBookingFlow initialData={data} bookingNotice={checkout === "unavailable"
    ? "That time is no longer available. Choose another time."
    : undefined} />
}
