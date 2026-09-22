import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  getValidGoogleCalendarEventId,
  getValidGoogleCalendarEventUrl,
  getValidGoogleMeetUrl,
} from "@/features/coaching-booking/lib"
import {
  getCalendarGridRange,
  listCalendarGridDates,
} from "@/features/coaching-booking/components/coaching-time-picker-utils"
import {
  listUpcomingCoachingBookings,
  resolveCoachingCreditSummary,
} from "@/features/coaching-booking/server/data"

const ROOT = process.cwd()

type PurchaseRow = { coaching_included: boolean | null }
type SubscriptionRow = {
  status: string
  metadata: Record<string, unknown> | null
}
type LedgerRow = { quantity: number; source: string; expires_at: string | null }
type BookingRow = {
  id: string
  org_id: string
  coach_id: string
  status: string
  price_tier: string
  starts_at: string
  ends_at: string
  timezone: string
  google_meet_url: string | null
  google_event_html_link: string | null
}

function createCreditSummarySupabaseStub({
  purchases = [],
  subscriptions = [],
  ledger = [],
}: {
  purchases?: PurchaseRow[]
  subscriptions?: SubscriptionRow[]
  ledger?: LedgerRow[]
}) {
  return {
    from(table: string) {
      if (table === "accelerator_purchases") {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                returns: async () => ({ data: purchases, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === "subscriptions") {
        return {
          select: () => ({
            in: () => ({
              in: () => ({
                returns: async () => ({ data: subscriptions, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === "coaching_credit_ledger") {
        return {
          select: () => ({
            eq: () => ({
              returns: async () => ({ data: ledger, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  } as never
}

function consumedCredits(count: number): LedgerRow[] {
  return Array.from({ length: count }, () => ({
    quantity: -1,
    source: "booking",
    expires_at: null,
  }))
}

function createUpcomingBookingsSupabaseStub(rows: BookingRow[]) {
  const calls: {
    statusEq?: string
    statusIn?: string[]
  } = {}

  return {
    calls,
    supabase: {
      from(table: string) {
        if (table !== "coaching_bookings") {
          throw new Error(`Unexpected table: ${table}`)
        }

        const filters: {
          orgId?: string
          status?: string
          statusIn?: string[]
          endsAfter?: string
        } = {}

        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            if (column === "org_id") filters.orgId = value
            if (column === "status") {
              filters.status = value
              calls.statusEq = value
            }
            return query
          },
          in: (column: string, values: string[]) => {
            if (column === "status") {
              filters.statusIn = values
              calls.statusIn = values
            }
            return query
          },
          gte: (column: string, value: string) => {
            if (column === "ends_at") filters.endsAfter = value
            return query
          },
          order: () => query,
          limit: () => ({
            returns: async () => ({
              data: rows
                .filter((row) =>
                  filters.orgId ? row.org_id === filters.orgId : true
                )
                .filter((row) =>
                  filters.status ? row.status === filters.status : true
                )
                .filter((row) =>
                  filters.statusIn
                    ? filters.statusIn.includes(row.status)
                    : true
                )
                .filter((row) =>
                  filters.endsAfter ? row.ends_at >= filters.endsAfter : true
                ),
              error: null,
            }),
          }),
        }

        return query
      },
    } as never,
  }
}

function readSource(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8")
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

describe("coaching booking feature", () => {
  it("adds coaching as a dashboard route backed by a feature slice", () => {
    const route = readSource("src/app/(dashboard)/coaching/page.tsx")
    const featureIndex = readSource("src/features/coaching-booking/index.ts")
    const featureLib = readSource("src/features/coaching-booking/lib/index.ts")
    const featureTypes = readSource("src/features/coaching-booking/types.ts")
    const page = readSource(
      "src/features/coaching-booking/components/coaching-booking-page.tsx"
    )
    const flow = readSource(
      "src/features/coaching-booking/components/coaching-booking-flow.tsx"
    )
    const participantStacks = readSource(
      "src/features/coaching-booking/components/coaching-participant-stacks.tsx"
    )
    const calendar = readSource("src/components/ui/calendar.tsx")
    const timePickerUtils = readSource(
      "src/features/coaching-booking/components/coaching-time-picker-utils.ts"
    )
    const appShell = readSource("src/components/app-shell/app-shell-inner.tsx")
    const shellMainContent = readSource(
      "src/components/app-shell/components/shell-main-content.tsx"
    )
    const scrollFade = readSource("src/components/scroll-fade-effect.tsx")
    const scrollFadeLogic = readSource("src/lib/scroll-fade-effect.ts")
    const wheelPicker = readSource("src/components/wheel-picker.tsx")
    const globals = readSource("src/app/globals.css")

    expect(route).toContain(
      'import { CoachingBookingPage } from "@/features/coaching-booking"'
    )
    expect(featureIndex).toContain(
      'export { CoachingBookingPage } from "./components"'
    )
    expect(page).toContain("loadCoachingBookingPageData")
    expect(page).toContain("cancelPendingCoachingCheckoutReturn")
    expect(page).toContain("confirmPaidCoachingCheckoutReturn")
    expect(page).toContain('checkout === "cancelled"')
    expect(page).toContain("if (!result.confirmed)")
    expect(page).toContain('checkout === "success"')
    expect(page).toContain('redirect("/login?redirect=/coaching")')
    expect(page).toContain("redirect(COACHING_PATH)")
    expect(page).toContain("userEmail: context.user.email ?? null")
    expect(featureLib).toContain("COACHING_SESSION_MINUTES = 45")
    expect(featureLib).toContain(
      'COACHING_DEFAULT_TIMEZONE = "America/Chicago"'
    )
    expect(flow).toContain(
      'import { AnimatePresence, motion, useReducedMotion } from "framer-motion"'
    )
    expect(flow).toContain(
      'import { Textarea } from "@/components/ui/textarea"'
    )
    expect(flow).toContain(
      'import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@/components/wheel-picker"'
    )
    expect(flow).not.toContain(
      'import { ScrollFadeEffect } from "@/components/scroll-fade-effect"'
    )
    expect(flow).toContain("Let's talk business")
    expect(flow).not.toContain(
      "Receive personalized guidance on nonprofit strategy, operations, fundraising, or program design."
    )
    expect(flow).toContain(
      "Book a 45-minute advisory meeting with Coach House leadership"
    )
    expect(flow).toContain("anything else you'd like to discuss.")
    expect(flow).toContain("function SessionDetailsDescription()")
    expect(flow).toContain("const SESSION_DETAILS_PREVIEW")
    expect(flow).toContain(
      "const detailsText = detailsExpanded ? SESSION_DETAILS_DESCRIPTION : SESSION_DETAILS_PREVIEW"
    )
    expect(flow).toContain('id="coaching-session-details-description"')
    expect(flow).not.toContain("line-clamp-2")
    expect(flow).toContain("<motion.p")
    expect(flow).toContain('<AnimatePresence initial={false} mode="wait">')
    expect(flow).toContain(
      '<span aria-hidden>{detailsExpanded ? " " : "… "}</span>'
    )
    expect(flow).toContain("aria-expanded={detailsExpanded}")
    expect(flow).toContain(
      'aria-controls="coaching-session-details-description"'
    )
    expect(flow).toContain(
      'aria-label={detailsExpanded ? "Show less meeting details" : "Show more meeting details"}'
    )
    expect(flow).toContain('detailsExpanded ? "View less" : "View more"')
    expect(flow).not.toContain("Full rate")
    expect(featureTypes).toContain("COACHING_ATTENDEE_NOTES_MAX_LENGTH = 1000")
    expect(featureTypes).toContain("attendeeNotes?: string")
    expect(featureTypes).toContain("export type CoachingParticipant")
    expect(featureTypes).toContain("currentUser: CoachingParticipant")
    expect(flow).toContain("SessionDetailsPanel")
    expect(flow).toContain(
      'import { BookingParticipantStack, SessionAvatarStack } from "./coaching-participant-stacks"'
    )
    expect(participantStacks).toContain(
      'import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"'
    )
    expect(participantStacks).toContain("function getFirstName(name: string)")
    expect(participantStacks).toContain(
      "return trimmedName.split(/\\s+/)[0] ?? trimmedName"
    )
    expect(participantStacks).toContain("function CoachingTooltipAvatar")
    expect(participantStacks).toContain("<Tooltip>")
    expect(participantStacks).toContain("<TooltipTrigger asChild>")
    expect(participantStacks).toContain("tabIndex={0}")
    expect(participantStacks).toContain("aria-label={person.name}")
    expect(participantStacks).toContain(
      '<TooltipContent side="top" sideOffset={8} className="text-xs font-medium">'
    )
    expect(participantStacks).toContain("{getFirstName(person.name)}")
    expect(participantStacks).toContain(
      "export function BookingParticipantStack"
    )
    expect(participantStacks).toContain("currentUser: CoachingParticipant")
    expect(participantStacks).toContain('className="flex -space-x-3"')
    expect(participantStacks).toContain('className="mx-auto flex -space-x-2.5"')
    expect(participantStacks).toContain('id: "current-user"')
    expect(participantStacks).toContain(
      "participants.map((participant) => participant.name).join"
    )
    expect(participantStacks).toContain("person.imageUrl ?")
    expect(participantStacks).toContain("src={person.imageUrl}")
    expect(flow).toContain("formatDurationLabel(COACHING_SESSION_MINUTES)")
    expect(flow).toContain("max-w-[42rem]")
    expect(flow).toContain(
      'type FlowStep = "date" | "time" | "review" | "done"'
    )
    expect(flow).toContain('useState<FlowStep>("date")')
    expect(flow).toContain("useState<1 | -1>(1)")
    expect(flow).toContain("xl:grid-cols-[17.5rem_minmax(0,1fr)]")
    expect(flow).not.toContain(
      "xl:grid-cols-[17.5rem_minmax(22rem,1fr)_17.5rem]"
    )
    expect(flow).toContain(
      '<Button onClick={confirmSelection} disabled={pending || checkoutUnavailable || !selectedSlot} className="shrink-0">'
    )
    expect(flow).toContain("Next")
    expect(flow).not.toContain("Use coaching credit")
    expect(flow).not.toContain("Continue to checkout")
    expect(flow).not.toContain("Confirming...")
    expect(flow).toContain("checkoutUnavailable")
    expect(flow).toContain("Coaching checkout is not configured yet.")
    expect(flow).not.toContain("TimeFormatToggle")
    expect(flow).not.toContain('aria-label="Time format"')
    expect(flow).not.toContain("useState<TimeFormat>")
    expect(flow).not.toContain("type TimeFormat")
    expect(flow).toContain(
      "const timezone = initialData.timezone || COACHING_DEFAULT_TIMEZONE"
    )
    expect(flow).not.toContain(
      "Intl.DateTimeFormat().resolvedOptions().timeZone"
    )
    expect(flow).toContain(
      'formatSlotTimeLabel(slot.startsAt, timezone, "12h")'
    )
    expect(flow).toContain(
      "flex min-h-full flex-1 items-stretch justify-start px-0 py-0 sm:items-center sm:justify-center sm:px-4 sm:py-6 lg:px-6"
    )
    expect(flow).toContain(
      "max-w-[42rem] flex-col gap-5 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:gap-6 sm:pb-0"
    )
    expect(flow).toContain(
      "border-border/70 bg-card overflow-hidden rounded-xl border shadow-sm"
    )
    expect(participantStacks).toContain(
      "border-background size-10 min-h-10 min-w-10 max-h-10 max-w-10 basis-10 border-2"
    )
    expect(participantStacks).toContain(
      "border-background size-9 min-h-9 min-w-9 max-h-9 max-w-9 basis-9 border-2"
    )
    expect(participantStacks).toContain(
      "outline-none hover:z-10 focus-visible:z-10"
    )
    expect(participantStacks).toContain(
      "focus-visible:ring-2 focus-visible:ring-ring"
    )
    expect(participantStacks).toContain(
      'const COACHING_AVATAR_IMAGE_CLASS = "block size-full object-cover"'
    )
    expect(participantStacks).toContain(
      'const COACHING_AVATAR_FALLBACK_CLASS = "size-full text-xs font-medium leading-none"'
    )
    expect(participantStacks).toContain(
      'const COACHING_REVIEW_AVATAR_FALLBACK_CLASS = "size-full text-[11px] font-medium leading-none"'
    )
    expect(flow).not.toContain("text-muted-foreground text-base font-medium")
    expect(flow).toContain(
      "text-foreground text-xl font-semibold tracking-normal sm:text-2xl"
    )
    expect(flow).toContain("grid grid-cols-[1.75rem_minmax(0,1fr)]")
    expect(flow).toContain('data-booking-scheduler-panel="true"')
    expect(flow).toContain(
      "border-border flex min-w-0 flex-col border-t px-4 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-3 xl:border-t-0 xl:border-l xl:px-6"
    )
    expect(flow).toContain('const showCalendarStep = step === "date"')
    expect(flow).toContain("const prefersReducedMotion = useReducedMotion()")
    expect(flow).toContain("duration: prefersReducedMotion ? 0 : 0.22")
    expect(flow).toContain("ease: [0.22, 1, 0.36, 1]")
    expect(flow).toContain("const stepMotion = prefersReducedMotion")
    expect(flow).toContain("const reviewMotion = prefersReducedMotion")
    expect(flow).toContain("function handleDateSelect(date: Date | undefined)")
    expect(flow).toContain("setStepDirection(1)")
    expect(flow).toContain('setStep("time")')
    expect(flow).toContain("function showCalendar()")
    expect(flow).toContain("setStepDirection(-1)")
    expect(flow).toContain('data-booking-step-viewport="true"')
    expect(flow).toContain(
      "relative -mx-3 flex min-h-[22rem] flex-1 overflow-hidden px-3 sm:min-h-[23rem]"
    )
    expect(flow).toContain(
      '<AnimatePresence initial={false} mode="wait" custom={stepDirection}>'
    )
    expect(flow).toContain('key="calendar-step"')
    expect(flow).toContain('key="time-step"')
    expect(flow).toContain("will-change-transform")
    expect(flow).toContain("initial={stepMotion.initial}")
    expect(flow).toContain("animate={stepMotion.animate}")
    expect(flow).toContain("exit={stepMotion.exit}")
    expect(flow).toContain('data-booking-calendar-panel="true"')
    expect(flow).toContain(
      "flex min-w-0 flex-1 flex-col items-center justify-start"
    )
    expect(flow).toContain("w-full min-w-0 max-w-[344px]")
    expect(flow).toContain("w-full p-0 [--cell-size:calc((100%_-_2.25rem)/7)]")
    expect(flow).toContain("onSelect={handleDateSelect}")
    expect(flow).not.toContain('data-booking-calendar-separator="true"')
    expect(flow).toContain('data-booking-time-panel="true"')
    expect(flow).not.toContain('aria-label="Change date"')
    expect(flow).not.toContain(
      "mx-auto flex w-full max-w-[344px] min-w-0 items-center"
    )
    expect(flow).toContain(
      'className="-ml-3 h-8 shrink-0 rounded-full px-3 shadow-none"'
    )
    expect(flow).toContain("Back")
    expect(flow).toContain("Choose another day")
    expect(flow).toContain("flex min-w-0 flex-1 flex-col")
    expect(flow).not.toContain(
      "border-border flex min-w-0 flex-col border-t px-4 pt-5 pb-0 sm:px-6 sm:pt-6 sm:pb-0 xl:border-t-0 xl:border-l xl:px-5"
    )
    expect(flow).not.toContain(
      "flex w-full flex-1 flex-col sm:mx-auto sm:w-[316px] sm:max-w-full"
    )
    expect(flow).not.toContain("xl:min-h-full")
    expect(flow).not.toContain("xl:mx-0")
    expect(flow).not.toContain("xl:w-[260px]")
    expect(flow).not.toContain("xl:[--cell-size:--spacing(8)]")
    expect(flow).not.toContain(
      "w-fit max-w-full p-0 [--cell-size:--spacing(10)]"
    )
    expect(flow).toContain('data-booking-review-footer="true"')
    expect(flow).toContain("mt-auto pt-5")
    expect(flow).toContain('data-booking-review-separator="true"')
    expect(flow).toContain(
      "border-border/70 mt-5 flex min-h-24 flex-col justify-center overflow-hidden rounded-xl border px-4 py-4"
    )
    expect(flow).toContain('<AnimatePresence initial={false} mode="wait">')
    expect(flow).toContain("initial={reviewMotion.initial}")
    expect(flow).toContain("animate={reviewMotion.animate}")
    expect(flow).toContain("exit={reviewMotion.exit}")
    expect(flow).toContain('aria-live="polite"')
    expect(flow).toContain(
      "bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full"
    )
    expect(flow).toContain("Choose a time")
    expect(flow).toContain(
      "Pick an open meeting above to review the meeting details."
    )
    expect(flow).not.toContain("grid h-11 min-h-11 w-full")
    expect(flow).not.toContain("sm:h-8 sm:min-h-8")
    expect(flow).toContain("setCalendarMonth((currentMonth)")
    expect(flow).toContain(
      "currentMonth.getTime() === nextMonth.getTime() ? currentMonth : nextMonth"
    )
    expect(flow).toContain("fixedWeeks")
    expect(flow).toContain("getCalendarGridRange")
    expect(flow).toContain("listCalendarGridDates(calendarMonth)")
    expect(flow).toContain(
      "const { from, to } = getCalendarGridRange(calendarMonth)"
    )
    expect(flow).not.toContain("const to = addMonths(from, 1)")
    expect(flow).toContain("flex min-w-0 items-center")
    expect(flow).not.toContain("text-foreground truncate text-xl font-semibold")
    expect(flow).not.toContain("h-9 min-h-9 min-w-12 rounded-md")
    expect(flow).not.toContain("sm:min-w-11")
    expect(flow).not.toContain(
      "bg-muted inline-flex w-fit shrink-0 rounded-lg p-0.5 sm:rounded-md"
    )
    expect(flow).toContain(
      "bg-background text-foreground inline-flex h-8 items-center"
    )
    expect(flow).toContain("sm:h-7")
    expect(flow).not.toContain("bg-emerald-500")
    expect(flow).not.toContain("border-emerald-500 bg-emerald-500/10")
    expect(flow).not.toContain("<ScrollFadeEffect")
    expect(flow).not.toContain('data-slot-scroll-area="true"')
    expect(flow).toContain("useMemo<WheelPickerOption<string>[]>")
    expect(flow).toContain(
      "const selectedSlotId = selectedSlot && selectedDaySlots.some"
    )
    expect(flow).toContain('data-slot-wheel-area="true"')
    expect(flow).toContain('<div className="flex min-w-0 flex-col">')
    expect(flow).not.toContain(
      "mt-4 flex min-h-64 min-w-0 flex-col justify-center"
    )
    expect(flow).toContain("mx-auto flex w-full max-w-[344px] flex-col gap-1.5")
    expect(flow).toContain(
      'className="text-foreground flex min-w-0 items-center gap-1 text-sm font-medium"'
    )
    expect(flow).toContain("<span>Availability</span>")
    expect(flow).toContain("•")
    expect(flow).toContain(
      'className="text-muted-foreground truncate">{selectedDateHeading}</span>'
    )
    expect(flow).toContain("<WheelPickerWrapper")
    expect(flow).toContain("border-border/90 bg-card/60 w-full shadow-none")
    expect(flow).toContain("<WheelPicker")
    expect(flow).toContain("value={selectedSlotId}")
    expect(flow).toContain("options={slotOptions}")
    expect(flow).toContain("visibleCount={8}")
    expect(flow).toContain("optionItemHeight={40}")
    expect(flow).toContain(
      'optionItem: "text-base font-medium leading-none tabular-nums"'
    )
    expect(flow).toContain(
      'highlightItem: "text-base font-semibold leading-none tabular-nums"'
    )
    expect(flow).toContain(
      'className="flex flex-col items-center gap-4 text-center"'
    )
    expect(flow).toContain('className="flex flex-col items-center gap-3"')
    expect(flow).toContain(
      "<BookingParticipantStack coaches={initialData.coaches} currentUser={initialData.currentUser} />"
    )
    expect(participantStacks).toContain(
      "avatarClassName={COACHING_REVIEW_AVATAR_CLASS}"
    )
    expect(flow).toContain("Confirm details")
    expect(flow).not.toContain("Review session")
    expect(flow).toContain("{formatDateTime(selectedSlot.startsAt, timezone)}")
    expect(flow).not.toContain(
      "{COACHING_JOINT_COACH_LABEL} · {formatDateTime(selectedSlot.startsAt, timezone)}"
    )
    expect(flow).toContain('data-booking-review-actions="true"')
    expect(flow).toContain(
      'className="mt-3 flex items-center justify-between gap-3"'
    )
    expect(
      flow.indexOf(
        "<BookingParticipantStack coaches={initialData.coaches} currentUser={initialData.currentUser} />"
      )
    ).toBeLessThan(flow.indexOf("Confirm details"))
    expect(flow.indexOf('aria-live="polite"')).toBeLessThan(
      flow.indexOf('data-booking-review-actions="true"')
    )
    expect(flow).toContain('data-booking-notes-field="true"')
    expect(flow).toContain("mt-1.5 flex flex-col gap-2")
    expect(flow).toContain('htmlFor="coaching-session-notes"')
    expect(flow).toContain("Notes")
    expect(flow).not.toContain("Session notes")
    expect(flow).toContain("value={attendeeNotes}")
    expect(flow).toContain("maxLength={COACHING_ATTENDEE_NOTES_MAX_LENGTH}")
    expect(flow).toContain(
      "Share priorities, questions, or context for the meeting…"
    )
    expect(flow).toContain("onChange={(event) => onChange(event.target.value)}")
    expect(flow).toContain("onChange={setAttendeeNotes}")
    expect(flow).toContain("attendeeNotes,")
    expect(flow).toContain(
      'setStep((currentStep) => (currentStep === "time" ? "review" : currentStep))'
    )
    expect(flow).toContain("Checking times…")
    expect(flow).not.toContain("max-h-[22rem]")
    expect(flow).toContain("availableCalendarDates")
    expect(flow).toContain("unavailableCalendarDates")
    expect(flow).toContain("available: availableCalendarDates")
    expect(flow).toContain("unavailable: unavailableCalendarDates")
    expect(flow).toContain("listCoachingAvailabilityAction")
    expect(flow).toContain("reserveCoachingBookingAction")
    expect(flow).not.toContain("groupSlotsByDate")
    expect(flow).toContain("getValidGoogleMeetUrl(booking.googleMeetUrl)")
    expect(flow).toContain("Join Google Meet")
    expect(flow).toContain(
      "Use this Google Calendar invite for updates or rescheduling."
    )
    expect(flow).toContain(
      "getValidGoogleCalendarEventUrl(booking.googleEventHtmlLink)"
    )
    expect(flow).toContain("googleEventHtmlLink ?? buildGoogleCalendarUrl")
    expect(flow).toContain("Calendar")
    expect(flow).toContain("AlertDialogTrigger asChild")
    expect(flow).toContain("Cancel this meeting?")
    expect(flow).toContain("Keep meeting")
    expect(flow).toContain("Cancel meeting")
    expect(flow).not.toContain("Reschedule")
    expect(flow).not.toContain("rescheduleCoachingBookingAction")
    expect(flow).not.toContain("Availability for")
    expect(flow).not.toContain("Joint availability")
    expect(flow).toContain("No open meetings on this date.")
    expect(flow).toContain(
      "Calendar availability is unavailable in this local environment."
    )
    expect(participantStacks).toContain("person.imageUrl ?")
    expect(participantStacks).toContain(
      "className={COACHING_AVATAR_IMAGE_CLASS}"
    )
    expect(participantStacks).toContain(
      "fallbackClassName={COACHING_REVIEW_AVATAR_FALLBACK_CLASS}"
    )
    expect(flow).not.toContain("Badge")
    expect(flow).not.toContain("Choose a coach")
    expect(flow).not.toContain("Coach calendars need connection")
    expect(flow).not.toContain("tracking-[0.22em]")
    expect(flow).not.toContain("Loading available times")
    expect(flow).not.toContain(
      "rounded-xl border border-border/70 px-3 py-3 text-sm text-muted-foreground"
    )
    expect(flow.indexOf('data-booking-time-panel="true"')).toBeLessThan(
      flow.indexOf('data-booking-review-separator="true"')
    )
    expect(flow.indexOf('data-booking-review-separator="true"')).toBeLessThan(
      flow.indexOf('aria-live="polite"')
    )
    expect(calendar).toContain("bg-transparent group/calendar")
    expect(calendar).toContain("w-full bg-transparent group/calendar")
    expect(calendar).not.toContain("bg-background group/calendar")
    expect(calendar).not.toContain("w-[16.25rem] max-w-full")
    expect(calendar).not.toContain('root: cn("w-fit"')
    expect(calendar).toContain('root: cn("w-full"')
    expect(calendar).toContain(
      "absolute top-0 right-0 flex items-center justify-end gap-1"
    )
    expect(calendar).toContain(
      "items-center justify-start pr-[calc(var(--cell-size)*2+0.25rem)]"
    )
    expect(calendar).toContain('table: "w-full border-collapse"')
    expect(calendar).toContain("flex w-full gap-1.5")
    expect(calendar).toContain("size-(--cell-size) items-center justify-center")
    expect(calendar).toContain("relative size-(--cell-size) p-0")
    expect(timePickerUtils).toContain(
      "export function getCalendarGridRange(month: Date)"
    )
    expect(timePickerUtils).toContain("to.setDate(to.getDate() + 42)")
    expect(timePickerUtils).toContain(
      "export function listCalendarGridDates(month: Date)"
    )
    expect(timePickerUtils).toContain("index < 42")
    expect(calendar).toContain("size-full min-w-0")
    expect(calendar).not.toContain("size-auto w-full min-w-(--cell-size)")
    expect(calendar).not.toContain(
      "[&:first-child[data-selected=true]_button]:rounded-l-md"
    )
    expect(calendar).toContain("data-[selected=true]:bg-transparent")
    expect(calendar).toContain("data-available={available}")
    expect(calendar).toContain("data-unavailable={unavailable}")
    expect(calendar).toContain("data-[available=true]:bg-muted")
    expect(calendar).toContain("data-[selected-single=true]:bg-foreground")
    expect(appShell).toContain("const isCoachingRoute =")
    expect(appShell).toContain(
      'pathname === "/coaching" || Boolean(pathname?.startsWith("/coaching/"))'
    )
    expect(appShell).toContain(
      "const useMobileSingleGutterContent = isCoachingRoute"
    )
    expect(appShell).toContain("useFlushContentBody={useFullBleedContent}")
    expect(shellMainContent).toContain("useMobileSingleGutterContent &&")
    expect(shellMainContent).toContain(
      'import { ScrollFadeEffect } from "@/components/scroll-fade-effect"'
    )
    expect(shellMainContent).toContain("<ScrollFadeEffect")
    expect(shellMainContent).toContain("enabled={isMobile && useMobileSingleGutterContent}")
    expect(shellMainContent).toContain(
      "[--mask-height:2rem] [--scroll-buffer:1.5rem]"
    )
    expect(appShell).toContain("useMobileSingleGutterContent")
    expect(shellMainContent).toContain("px-[var(--shell-content-pad)]")
    expect(appShell).toContain("useFullBleedContent")
    expect(shellMainContent).toContain('? "overflow-hidden"')
    expect(shellMainContent).toContain(': "overflow-y-auto"')
    expect(scrollFade).toContain("enabled?: boolean")
    expect(scrollFade).toContain(
      "scroll-fade-effect-y overflow-y-auto"
    )
    expect(scrollFade).toContain("useScrollFadeEffect")
    expect(scrollFadeLogic).toContain("dataset.scrollFadeStart")
    expect(scrollFadeLogic).toContain("dataset.scrollFadeEnd")
    expect(scrollFade).not.toContain("data-vertical")
    expect(wheelPicker).toContain(
      'import "@ncdai/react-wheel-picker/style.css"'
    )
    expect(wheelPicker).toContain('from "@ncdai/react-wheel-picker"')
    expect(wheelPicker).toContain(
      "border-border bg-background w-56 rounded-lg border px-1 shadow-xs"
    )
    expect(wheelPicker).toContain(
      "text-muted-foreground/65 data-disabled:opacity-40"
    )
    expect(wheelPicker).toContain(
      "data-rwp-focused:inset-ring-ring/50 data-rwp-focused:inset-ring-2"
    )
    expect(globals).toContain("@utility scroll-fade-effect-y")
    expect(globals).toContain("animation-timeline: scroll(self), scroll(self)")
    expect(globals).toContain("--top-mask-height: 0px")
    expect(globals).toContain("--bottom-mask-height: var(--mask-height)")
    expect(globals).toContain("--left-mask-width: 0px")
    expect(globals).toContain("--right-mask-width: var(--mask-width)")
    expect(globals).toContain(
      '.scroll-fade-effect-y[data-scroll-fade-managed="true"]'
    )
    expect(globals).toContain(
      '.scroll-fade-effect-y[data-scroll-fade-start="visible"]'
    )
  })

  it("loads availability for every visible fixed-week calendar date", () => {
    const june2026 = new Date(2026, 5, 1)
    const dates = listCalendarGridDates(june2026)
    const range = getCalendarGridRange(june2026)

    expect(dates).toHaveLength(42)
    expect(localDateKey(dates[0])).toBe("2026-05-31")
    expect(localDateKey(dates[41])).toBe("2026-07-11")
    expect(localDateKey(range.from)).toBe("2026-05-31")
    expect(localDateKey(range.to)).toBe("2026-07-12")
  })

  it("routes sidebar coaching entrypoints to /coaching instead of opening the legacy schedule link", () => {
    const card = readSource("src/components/coaching/coach-scheduling-card.tsx")
    const sidebarItem = readSource(
      "src/components/coaching/coach-scheduling-sidebar-item.tsx"
    )
    const navUser = readSource(
      "src/components/nav-user/nav-user-menu-content.tsx"
    )
    const hook = readSource("src/hooks/use-coaching-booking.ts")

    expect(card).toContain('<Link href="/coaching">Book a meeting</Link>')
    expect(sidebarItem).toContain('<Link href="/coaching">')
    expect(navUser).not.toContain('href="/coaching"')
    expect(hook).toContain('router.push("/coaching")')
    expect(hook).not.toContain("/api/meetings/schedule")
  })

  it("adds DB-backed bookings, credits, RLS, and Stripe webhook handoff", () => {
    const migration = readSource(
      "supabase/migrations/20260517193000_add_coaching_booking.sql"
    )
    const notesMigration = readSource(
      "supabase/migrations/20260529152500_add_coaching_booking_attendee_notes.sql"
    )
    const schema = readSource(
      "src/lib/supabase/schema/tables/coaching_bookings.ts"
    )
    const webhook = readSource(
      "src/app/api/stripe/webhook/_lib/process-event.ts"
    )
    const stripeProcessor = readSource(
      "src/features/coaching-booking/server/stripe.ts"
    )
    const finalizer = readSource(
      "src/features/coaching-booking/server/booking-finalizer.ts"
    )
    const email = readSource("src/features/coaching-booking/server/email.ts")
    const actions = readSource(
      "src/features/coaching-booking/server/actions.ts"
    )
    const data = readSource("src/features/coaching-booking/server/data.ts")
    const stripeRuntime = readSource("src/lib/billing/stripe-runtime.ts")
    const checkoutReturn = readSource(
      "src/features/coaching-booking/server/checkout-return.ts"
    )
    const icsRoute = readSource(
      "src/app/api/coaching/bookings/[id]/calendar.ics/route.ts"
    )

    expect(migration).toContain("create table if not exists coaching_coaches")
    expect(migration).toContain("create table if not exists coaching_bookings")
    expect(migration).toContain(
      "create table if not exists coaching_credit_ledger"
    )
    expect(migration).toContain(
      "alter table coaching_bookings enable row level security"
    )
    expect(notesMigration).toContain(
      "add column if not exists attendee_notes text"
    )
    expect(schema).toContain("attendee_notes: string | null")
    expect(migration).toContain("coaching_credit_ledger_select")
    expect(webhook).toContain("processCoachingCheckoutSession(session)")
    expect(stripeProcessor).toContain(
      'session.metadata?.kind !== "coaching_booking"'
    )
    expect(actions).toContain('kind: "coaching_booking"')
    expect(actions).toContain("booking_id: bookingId")
    expect(actions).toContain("price_tier: priceTier")
    expect(actions).toContain("resolveStripeRuntimeConfigForCoaching")
    expect(actions).toContain(
      "getValidGoogleCalendarEventId(booking.google_event_id)"
    )
    expect(actions).toContain('requestHeaders.get("origin")')
    expect(actions).toContain("Unable to create the coach calendar event.")
    expect(actions).toContain("COACHING_JOINT_COACH_IDS.map")
    expect(actions).toContain("COACHING_JOINT_PRIMARY_COACH_ID")
    expect(actions).toContain("input.timezone || COACHING_DEFAULT_TIMEZONE")
    expect(actions).not.toContain('input.timezone || "America/New_York"')
    expect(actions).toContain("normalizeAttendeeNotes")
    expect(actions).toContain("attendee_notes: attendeeNotes")
    expect(actions).toContain("Keep notes under")
    expect(data).toContain("isStripeCoachingCheckoutConfigured")
    expect(data).toContain("paymentConfigured")
    expect(data).toContain("useTesterRuntime: audience.isAdmin")
    expect(data).toContain("loadCoachingCurrentUserProfile")
    expect(data).toContain('.from("profiles")')
    expect(data).toContain('.select("full_name, avatar_url, email")')
    expect(data).toContain("currentUser")
    expect(stripeRuntime).toContain("STRIPE_TEST_COACHING_FULL_PRICE_ID")
    expect(stripeRuntime).toContain("STRIPE_TEST_COACHING_DISCOUNTED_PRICE_ID")
    expect(stripeRuntime).toContain("resolveStripeRuntimeConfigForCoaching")
    expect(stripeRuntime).toContain('process.env.NODE_ENV !== "production"')
    expect(stripeRuntime).toContain("useTesterRuntime")
    expect(actions).toContain("useTesterRuntime: audience.isAdmin")
    expect(actions).not.toContain(
      "resolveStripeRuntimeConfigForCoaching({ isTester: audience.isTester"
    )
    expect(stripeRuntime).toContain(
      "coachingFullPriceId: normalizeString(env.STRIPE_TEST_COACHING_FULL_PRICE_ID)"
    )
    expect(stripeRuntime).not.toContain(
      "normalizeString(env.STRIPE_TEST_COACHING_FULL_PRICE_ID) ??"
    )
    expect(checkoutReturn).toContain("checkout.sessions.retrieve")
    expect(checkoutReturn).toContain('session.payment_status === "paid"')
    expect(checkoutReturn).toContain("confirmCoachingBooking")
    expect(checkoutReturn).toContain('booking.status === "confirmed"')
    expect(checkoutReturn).toContain("attendee_notes")
    expect(finalizer).toContain("createGoogleCoachingEvent")
    expect(finalizer).toContain(
      "getValidGoogleCalendarEventId(calendarEvent.googleEventId)"
    )
    expect(finalizer).toContain(
      "getValidGoogleCalendarEventUrl(calendarEvent.googleEventHtmlLink)"
    )
    expect(finalizer).toContain(
      "getValidGoogleMeetUrl(calendarEvent.googleMeetUrl)"
    )
    expect(finalizer).toContain("sendCoachingBookingConfirmationEmails")
    expect(finalizer).toContain("internalAttendeeEmails")
    expect(finalizer).toContain(
      "Coach House meeting with ${COACHING_JOINT_COACH_LABEL}"
    )
    expect(finalizer).toContain("Meeting notes from attendee:")
    expect(finalizer).toContain("attendeeNotes: booking.attendee_notes")
    expect(finalizer).toContain('source: "booking"')
    expect(email).toContain("sendResendEmail")
    expect(email).toContain("Your Coach House coaching meeting is confirmed")
    expect(email).toContain("New Coach House coaching meeting booked")
    expect(email).toContain("attendeeNotes?: string | null")
    expect(email).toContain("Notes: ${normalizedAttendeeNotes}")
    expect(email).toContain(
      "getValidGoogleCalendarEventUrl(googleEventHtmlLink)"
    )
    expect(icsRoute).toContain("COACHING_JOINT_COACH_LABEL")
    expect(icsRoute).toContain(
      'const CANONICAL_SITE_URL = "https://coachhouse.app"'
    )
    expect(icsRoute).toContain("function resolveSiteUrl(request: NextRequest)")
    expect(icsRoute).toContain("!isLocalUrl(normalized)")
    expect(icsRoute).toContain("getValidGoogleMeetUrl(booking.google_meet_url)")
    expect(icsRoute).toContain(
      "getValidGoogleCalendarEventUrl(booking.google_event_html_link)"
    )
    expect(icsRoute).toContain("attendee_notes")
    expect(icsRoute).toContain("Coach House Advisory Meeting with")
    expect(icsRoute).toContain(
      'const ICS_FILENAME_PREFIX = "coach-house-advisory-meeting"'
    )
    expect(icsRoute).toContain(
      "function buildIcsDownloadFilename(startsAt: string, timeZone: string)"
    )
    expect(icsRoute).toContain(
      "buildIcsDownloadFilename(booking.starts_at, booking.timezone)"
    )
    expect(icsRoute).toContain('filename="${downloadFilename}"')
    expect(icsRoute).toContain("buildIcsOrganizerLine")
    expect(icsRoute).toContain("COACHING_JOINT_PRIMARY_COACH_ID")
    expect(icsRoute).toContain("ORGANIZER;CN=")
    expect(icsRoute).toContain("buildIcsAttendeeLines")
    expect(icsRoute).toContain("getGoogleCoachingParticipantEmail(coachId)")
    expect(icsRoute).toContain("ATTENDEE;CN=")
    expect(icsRoute).toContain("ROLE=REQ-PARTICIPANT")
    expect(icsRoute).toContain("STATUS:CONFIRMED")
    expect(icsRoute).toContain("TRANSP:OPAQUE")
    expect(icsRoute).toContain("CATEGORIES:Coach House,Coaching")
    expect(icsRoute).toContain("LOCATION:Google Meet")
    expect(icsRoute).toContain(
      'CONFERENCE;VALUE=URI;FEATURE=AUDIO,VIDEO;LABEL="Google Meet"'
    )
    expect(icsRoute).toContain("foldIcsLine")
    expect(icsRoute).not.toContain("LOCATION:${escapeIcsText(googleMeetUrl)}")
    expect(icsRoute).not.toContain('filename="coach-house-${booking.id}.ics"')
  })

  it("only exposes syntactically valid Google links", () => {
    expect(getValidGoogleMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(
      "https://meet.google.com/abc-defg-hij"
    )
    expect(
      getValidGoogleMeetUrl("https://meet.google.com/abc-defg-hij?hs=122")
    ).toBe("https://meet.google.com/abc-defg-hij?hs=122")
    expect(
      getValidGoogleMeetUrl("https://meet.google.com/local-test")
    ).toBeNull()
    expect(getValidGoogleMeetUrl("https://example.com/abc-defg-hij")).toBeNull()
    expect(getValidGoogleMeetUrl(null)).toBeNull()
    expect(
      getValidGoogleCalendarEventUrl(
        "https://calendar.google.com/calendar/event?eid=abc123"
      )
    ).toBe("https://calendar.google.com/calendar/event?eid=abc123")
    expect(
      getValidGoogleCalendarEventUrl(
        "https://www.google.com/calendar/event?eid=abc123"
      )
    ).toBe("https://www.google.com/calendar/event?eid=abc123")
    expect(
      getValidGoogleCalendarEventUrl("http://localhost:8787/events/local-test")
    ).toBeNull()
    expect(
      getValidGoogleCalendarEventUrl("https://calendar.google.com/test")
    ).toBeNull()
    expect(getValidGoogleCalendarEventUrl(null)).toBeNull()
    expect(getValidGoogleCalendarEventId("abc123")).toBe("abc123")
    expect(getValidGoogleCalendarEventId("local-test")).toBeNull()
    expect(getValidGoogleCalendarEventId(null)).toBeNull()
  })

  it("keeps Google Calendar writes behind a server adapter", () => {
    const google = readSource(
      "src/features/coaching-booking/server/google-calendar.ts"
    )
    const actions = readSource(
      "src/features/coaching-booking/server/actions.ts"
    )

    expect(google).toContain("GOOGLE_COACHING_BROKER_URL")
    expect(google).toContain("x-coach-house-signature")
    expect(google).toContain("x-vercel-oidc-token")
    expect(google).toContain("https://sts.googleapis.com/v1/token")
    expect(google).toContain("generateIdToken")
    expect(google).toContain("https://oauth2.googleapis.com/token")
    expect(google).toContain("/freeBusy")
    expect(google).toContain("conferenceDataVersion=1")
    expect(google).toContain("GOOGLE_COACHING_PAULA_IMPERSONATED_USER")
    expect(google).toContain('type: "hangoutsMeet"')
    expect(google).toContain("waitForMeetUrl")
    expect(google).toContain("requestId: randomUUID()")
    expect(google).toContain("Attendee: ${attendeeEmail}")
    expect(google).toContain(
      "buildGoogleEventAttendees({ attendeeEmail, internalAttendeeEmails: internalAttendees })"
    )
    expect(google).toContain('[attendeeEmail ?? "", ...internalAttendeeEmails]')
    expect(google).toContain("DEFAULT_COACHING_PARTICIPANT_EMAILS")
    expect(google).toContain('joel: "joel@coachhousesolutions.org"')
    expect(google).toContain('paula: "paula@coachhousesolutions.org"')
    expect(google).toContain(
      "Use this Google Calendar invite for updates or rescheduling."
    )
    expect(google).toContain("internalAttendeeEmails")
    expect(google).toContain(
      "buildGoogleEventAttendees({ attendeeEmail, internalAttendeeEmails: internalAttendees })"
    )
    expect(google).toContain("getGoogleCoachingParticipantEmail")
    expect(google).toContain("isLocalBrokerUrl")
    expect(google).toContain(
      "Local Google Calendar broker proxy is not running."
    )
    expect(google).toContain("!isLocalBrokerUrl(brokerUrl)")
    expect(actions).toContain("isGoogleCoachingConfigured")
    expect(actions).toContain("Coach calendar is not connected yet.")
  })

  it("adds a keyless Cloud Run broker for Google Calendar service-account access", () => {
    const broker = readSource(
      "src/cloud-run/coaching-calendar-broker/server.mjs"
    )
    const brokerPackage = readSource(
      "src/cloud-run/coaching-calendar-broker/package.json"
    )
    const featureReadme = readSource("src/features/coaching-booking/README.md")

    expect(brokerPackage).toContain('"start": "node server.mjs"')
    expect(broker).toContain("metadata.google.internal")
    expect(broker).toContain("iamcredentials.googleapis.com")
    expect(broker).toContain("generateAccessToken")
    expect(broker).toContain("signJwt")
    expect(broker).toContain("GOOGLE_COACHING_PAULA_IMPERSONATED_USER")
    expect(broker).toContain('type: "hangoutsMeet"')
    expect(broker).toContain("waitForMeetUrl")
    expect(broker).toContain("https://www.googleapis.com/auth/calendar")
    expect(broker).toContain("timingSafeEqual")
    expect(broker).toContain("COACHING_CALENDAR_BROKER_SECRET")
    expect(broker).toContain("Google Calendar freeBusy failed")
    expect(broker).toContain("detail.slice(0, 500)")
    expect(broker).toContain("Attendee: ${payload.attendeeEmail}")
    expect(broker).toContain("attendeeEmail: payload.attendeeEmail")
    expect(broker).toContain('[attendeeEmail ?? "", ...internalAttendeeEmails]')
    expect(broker).toContain(
      "Use this Google Calendar invite for updates or rescheduling."
    )
    expect(broker).toContain("internalAttendeeEmails")
    expect(broker).toContain("buildGoogleEventAttendees({")
    expect(featureReadme).toContain("keyless Cloud Run broker")
    expect(featureReadme).toContain("Vercel OIDC")
  })

  it("limits discounted paid booking to Operations Support after included credits are gone", async () => {
    const included = await resolveCoachingCreditSummary({
      supabase: createCreditSummarySupabaseStub({
        purchases: [{ coaching_included: true }],
        ledger: consumedCredits(3),
      }),
      userId: "user-1",
      orgId: "org-1",
    })
    const nonOperationsAfterCredits = await resolveCoachingCreditSummary({
      supabase: createCreditSummarySupabaseStub({
        purchases: [{ coaching_included: true }],
        ledger: consumedCredits(4),
      }),
      userId: "user-1",
      orgId: "org-1",
    })
    const operationsSupport = await resolveCoachingCreditSummary({
      supabase: createCreditSummarySupabaseStub({
        subscriptions: [
          {
            status: "active",
            metadata: {
              planName: "Operations Support",
              plan_tier: "operations_support",
            },
          },
        ],
      }),
      userId: "user-1",
      orgId: "org-1",
    })

    expect(included).toMatchObject({
      available: 1,
      priceTier: "included",
      hasDiscountAccess: false,
    })
    expect(nonOperationsAfterCredits).toMatchObject({
      available: 0,
      priceTier: "full",
      hasDiscountAccess: false,
    })
    expect(operationsSupport).toMatchObject({
      available: 0,
      priceTier: "discounted",
      hasDiscountAccess: true,
    })
  })

  it("shows only paid-confirmed bookings in the upcoming list", async () => {
    const pendingStartsAt = "2099-01-01T15:00:00.000Z"
    const confirmedStartsAt = "2099-01-02T15:00:00.000Z"
    const { calls, supabase } = createUpcomingBookingsSupabaseStub([
      {
        id: "pending-booking",
        org_id: "org-1",
        coach_id: "joel",
        status: "pending_payment",
        price_tier: "full",
        starts_at: pendingStartsAt,
        ends_at: "2099-01-01T16:00:00.000Z",
        timezone: "America/Chicago",
        google_meet_url: null,
        google_event_html_link: null,
      },
      {
        id: "confirmed-booking",
        org_id: "org-1",
        coach_id: "paula",
        status: "confirmed",
        price_tier: "full",
        starts_at: confirmedStartsAt,
        ends_at: "2099-01-02T16:00:00.000Z",
        timezone: "America/Chicago",
        google_meet_url: "https://meet.google.com/test",
        google_event_html_link:
          "https://calendar.google.com/calendar/event?eid=abc123",
      },
    ])

    const bookings = await listUpcomingCoachingBookings({
      supabase,
      orgId: "org-1",
    })

    expect(calls.statusEq).toBe("confirmed")
    expect(calls.statusIn).toBeUndefined()
    expect(bookings).toHaveLength(1)
    expect(bookings[0]).toMatchObject({
      id: "confirmed-booking",
      status: "confirmed",
      coachName: "Joel & Paula",
    })
  })
})
