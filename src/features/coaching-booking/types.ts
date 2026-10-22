import type { CoachingCoachId } from "@/lib/meetings"

export type { CoachingCoachId } from "@/lib/meetings"

export const COACHING_ATTENDEE_NOTES_MAX_LENGTH = 1000

export type CoachingBookingStatus =
  | "held"
  | "pending_payment"
  | "confirmed"
  | "canceled"
  | "rescheduled"
  | "completed"
  | "no_show"

export type CoachingPriceTier = "included" | "discounted" | "full"

export type CoachingCoach = {
  id: CoachingCoachId
  name: string
  title: string
  focus: string
  initials: string
  imageUrl: string
}

export type CoachingParticipant = {
  calendarName?: string | null
  name: string
  initials: string
  imageUrl: string | null
}

export type CoachingCreditSummary = {
  available: number
  includedAllowance: number
  ledgerBalance: number
  consumed: number
  priceTier: CoachingPriceTier
  hasDiscountAccess: boolean
}

export type CoachingSlot = {
  id: string
  coachId: CoachingCoachId
  startsAt: string
  endsAt: string
  dateLabel: string
  timeLabel: string
  available: boolean
}

export type CoachingBookingRecord = {
  calendarTitle?: string
  id: string
  coachId: CoachingCoachId
  coachName: string
  status: CoachingBookingStatus
  priceTier: CoachingPriceTier
  startsAt: string
  endsAt: string
  timezone: string
  googleMeetUrl: string | null
  googleEventHtmlLink: string | null
  canManage: boolean
}

export type CoachingBookingPageData = {
  coaches: CoachingCoach[]
  selectedCoachId: CoachingCoachId
  currentUser: CoachingParticipant
  creditSummary: CoachingCreditSummary
  upcomingBookings: CoachingBookingRecord[]
  timezone: string
  calendarConfigured: boolean
  paymentConfigured: boolean
}

export type CoachingAvailabilityInput = {
  coachId: CoachingCoachId
  from: string
  to: string
  timezone: string
}

export type CoachingBookingInput = {
  coachId: CoachingCoachId
  startsAt: string
  timezone: string
  attendeeNotes?: string
}

export type CoachingManageBookingInput = {
  bookingId: string
  reason?: string
  requestId?: string
}

export type CoachingActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: "COACHING_SLOT_UNAVAILABLE" }
