"use client"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  reserveCoachingBookingAction,
  cancelCoachingBookingAction,
} from "../actions"
import type { CoachingCoachId, CoachingSlot } from "../types"

export function useCoachingBookingActions({
  selectedSlot,
  checkoutUnavailable,
  selectedCoachId,
  timezone,
  attendeeNotes,
  onBooked,
  onUnavailable,
}: {
  selectedSlot: CoachingSlot | null
  checkoutUnavailable: boolean
  selectedCoachId: CoachingCoachId
  timezone: string
  attendeeNotes: string
  onBooked: () => void
  onUnavailable?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  function confirmSelection() {
    if (!selectedSlot) return
    if (checkoutUnavailable) {
      toast.error("Coaching checkout is not configured yet.")
      return
    }
    startTransition(async () => {
      try {
        const result = await reserveCoachingBookingAction({
          coachId: selectedCoachId,
          startsAt: selectedSlot.startsAt,
          timezone,
          attendeeNotes,
        })

        if (!result.ok) {
          toast.error(result.error)
          if (result.code === "COACHING_SLOT_UNAVAILABLE") onUnavailable?.()
          return
        }
        if ("checkoutUrl" in result && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl)
          return
        }
        if (!result.confirmed) {
          toast.error("Your meeting is not confirmed. Refresh and choose another time.")
          onUnavailable?.()
          router.refresh()
          return
        }
        router.refresh()
        toast.success("Meeting booked.")
        onBooked()
      } catch {
        toast.error(
          "Unable to confirm the meeting. Refresh before trying again."
        )
        router.refresh()
      }
    })
  }

  function cancelBooking(bookingId: string) {
    startTransition(async () => {
      try {
        const result = await cancelCoachingBookingAction({ bookingId })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(
          result.creditRestored
            ? "Meeting canceled. Credit restored."
            : "Meeting canceled. Credit remains used."
        )
        router.refresh()
      } catch {
        toast.error("Unable to cancel the meeting. Try again.")
      }
    })
  }

  return { pending, confirmSelection, cancelBooking }
}
