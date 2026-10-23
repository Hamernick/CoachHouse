"use client"

import { buildCoachingCalendarTitle } from "../lib/calendar-title"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import CalendarCheckIcon from "lucide-react/dist/esm/icons/calendar-check"
import CalendarPlusIcon from "lucide-react/dist/esm/icons/calendar-plus"
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left"
import ClockIcon from "lucide-react/dist/esm/icons/clock"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"
import Globe2Icon from "lucide-react/dist/esm/icons/globe-2"
import UsersIcon from "lucide-react/dist/esm/icons/users"
import VideoIcon from "lucide-react/dist/esm/icons/video"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { SessionNotesField } from "./coaching-session-notes-field"
import { CoachingRescheduleDialog } from "./coaching-reschedule-dialog"
import { useCoachingBookingActions } from "../hooks/use-coaching-booking-actions"
import { useCoachingCheckoutNotice } from "../hooks/use-coaching-checkout-notice"
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@/components/wheel-picker"
import { COACHING_DEFAULT_TIMEZONE, COACHING_PATH, COACHING_SESSION_MINUTES, getValidGoogleMeetUrl, getValidGoogleCalendarEventUrl } from "../lib"
import { listCoachingAvailabilityAction } from "../actions"
import { BookingParticipantStack, SessionAvatarStack } from "./coaching-participant-stacks"
import { dateFromKey, dateKey, formatSlotTimeLabel, getCalendarGridRange, listCalendarGridDates, startOfMonth, zonedDateKey } from "./coaching-time-picker-utils"
import { type CoachingBookingPageData, type CoachingBookingRecord, type CoachingCoach, type CoachingSlot } from "../types"

type CoachingBookingFlowProps = {
  initialData: CoachingBookingPageData
  bookingNotice?: string
}

type FlowStep = "date" | "time" | "review" | "done"

const SESSION_DETAILS_DESCRIPTION =
  "Book a 45-minute advisory meeting with Coach House leadership to get expert support on your organization's next steps or anything else you'd like to discuss."
const SESSION_DETAILS_PREVIEW = "Book a 45-minute advisory meeting with Coach House leadership"

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value))
}

function buildGoogleCalendarUrl(booking: CoachingBookingRecord) {
  const googleMeetUrl = getValidGoogleMeetUrl(booking.googleMeetUrl)
  const dates = `${booking.startsAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/${booking.endsAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: booking.calendarTitle ?? buildCoachingCalendarTitle(),
    dates,
    details: googleMeetUrl
      ? `Join Google Meet: ${googleMeetUrl}\nUse this Google Calendar invite for updates or rescheduling.`
      : "Coach House coaching meeting. Use this Google Calendar invite for updates or rescheduling.",
    location: googleMeetUrl ?? "Online",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function formatDurationLabel(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

function formatAvailabilityMessage(message: string | null) {
  if (!message) return "No open meetings on this date."
  if (message.includes("Local Google Calendar broker proxy is not running")) {
    return "Calendar availability is unavailable in this local environment. Start the calendar connection and refresh."
  }
  if (message.includes("Google Calendar broker request failed")) {
    return "Calendar availability is temporarily unavailable. Refresh in a moment."
  }
  return message
}

function priceTierLabel(tier: CoachingBookingPageData["creditSummary"]["priceTier"]) {
  if (tier === "included") return "Included meeting"
  if (tier === "discounted") return "Discounted rate"
  return null
}

function SessionMetaRow({ icon: Icon, children }: { icon: typeof ClockIcon; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-3">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function SessionDetailsDescription() {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const reduceMotion = useReducedMotion()
  const detailsText = detailsExpanded ? SESSION_DETAILS_DESCRIPTION : SESSION_DETAILS_PREVIEW
  const descriptionTransition = {
    duration: reduceMotion ? 0 : 0.18,
    ease: [0.22, 1, 0.36, 1],
  } as const

  return (
    <motion.p id="coaching-session-details-description" layout className="text-muted-foreground min-w-0 text-sm leading-6" transition={descriptionTransition}>
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={detailsExpanded ? "expanded" : "collapsed"}
          className="inline"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
          transition={descriptionTransition}
        >
          <span>{detailsText}</span>
          <span aria-hidden>{detailsExpanded ? " " : "… "}</span>
          <button
            type="button"
            className="text-foreground hover:text-foreground/80 focus-visible:ring-ring relative inline-flex rounded-sm px-0.5 text-xs font-medium underline underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            aria-expanded={detailsExpanded}
            aria-controls="coaching-session-details-description"
            aria-label={detailsExpanded ? "Show less meeting details" : "Show more meeting details"}
            onClick={() => setDetailsExpanded((current) => !current)}
          >
            {detailsExpanded ? "View less" : "View more"}
          </button>
        </motion.span>
      </AnimatePresence>
    </motion.p>
  )
}

function SessionDetailsPanel({ coaches, creditSummary, timezone }: { coaches: CoachingCoach[]; creditSummary: CoachingBookingPageData["creditSummary"]; timezone: string }) {
  const priceTier = priceTierLabel(creditSummary.priceTier)

  return (
    <aside className="border-border flex flex-col gap-5 border-b px-4 py-5 sm:p-6 xl:border-r xl:border-b-0">
      <div className="flex flex-col gap-4">
        <SessionAvatarStack coaches={coaches} />
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground text-xl font-semibold tracking-normal sm:text-2xl">{"Let's talk business"}</h2>
          <SessionDetailsDescription />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SessionMetaRow icon={ClockIcon}>
          <div className="bg-muted inline-flex rounded-lg p-0.5">
            <span className="bg-background text-foreground inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium shadow-sm sm:h-7">
              {formatDurationLabel(COACHING_SESSION_MINUTES)}
            </span>
          </div>
        </SessionMetaRow>
        <SessionMetaRow icon={VideoIcon}>
          <span className="text-muted-foreground text-sm font-medium">Google Meet</span>
        </SessionMetaRow>
        <SessionMetaRow icon={Globe2Icon}>
          <span className="text-muted-foreground block truncate text-sm font-medium">{timezone}</span>
        </SessionMetaRow>
        <SessionMetaRow icon={UsersIcon}>
          <span className="text-muted-foreground text-sm font-medium">
            {creditSummary.available} credit
            {creditSummary.available === 1 ? "" : "s"}
            {priceTier ? <> · {priceTier}</> : null}
          </span>
        </SessionMetaRow>
        <p className="text-muted-foreground text-xs leading-5">
          Cancel at least 4 hours before to restore your credit. Late cancellations and no-shows use the credit.
          Late reschedules require another credit. Coach cancellations restore your credit.
        </p>
      </div>
    </aside>
  )
}

function BookingRow({ booking, onCancel, pending }: { booking: CoachingBookingRecord; onCancel: () => void; pending: boolean }) {
  const googleMeetUrl = getValidGoogleMeetUrl(booking.googleMeetUrl)
  const formattedStart = formatDateTime(booking.startsAt, booking.timezone)
  const googleEventHtmlLink = getValidGoogleCalendarEventUrl(booking.googleEventHtmlLink)
  const googleCalendarUrl = googleEventHtmlLink ?? buildGoogleCalendarUrl(booking)

  return (
    <div className="border-border/70 flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-muted text-muted-foreground inline-flex size-9 items-center justify-center rounded-full">
          <CalendarCheckIcon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{booking.coachName}</span>
          <span className="text-muted-foreground text-xs">{formattedStart}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {googleMeetUrl ? (
          <Button asChild size="sm" variant="outline" className="h-8 rounded-full shadow-none">
            <a href={googleMeetUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" aria-hidden />
              Meet
            </a>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full shadow-none">
          <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
            <CalendarPlusIcon data-icon="inline-start" aria-hidden />
            Calendar
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full shadow-none">
          <a href={`/api/coaching/bookings/${booking.id}/calendar.ics`}>
            <CalendarPlusIcon data-icon="inline-start" aria-hidden />
            Apple
          </a>
        </Button>
        {booking.canManage ? (
          <>
            <CoachingRescheduleDialog booking={booking} disabled={pending} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 rounded-full" disabled={pending}>
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cancels your {formattedStart} coaching meeting with {booking.coachName} and removes the coach calendar event. Your credit is restored only with at least 4 hours notice; later cancellations forfeit it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>Keep meeting</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={pending} onClick={onCancel}>
                    Cancel meeting
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function CoachingBookingFlow({ initialData, bookingNotice }: CoachingBookingFlowProps) {
  const [step, setStep] = useState<FlowStep>("date")
  const [checkoutNoticeDismissed, setCheckoutNoticeDismissed] = useState(false)
  const checkoutNotice = useCoachingCheckoutNotice(bookingNotice, checkoutNoticeDismissed)
  const [stepDirection, setStepDirection] = useState<1 | -1>(1)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [slots, setSlots] = useState<CoachingSlot[]>([])
  const [availabilityRevision, setAvailabilityRevision] = useState(0)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<CoachingSlot | null>(null)
  const [attendeeNotes, setAttendeeNotes] = useState("")
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const availabilityRequestId = useRef(0)
  const timezone = initialData.timezone || COACHING_DEFAULT_TIMEZONE
  const selectedDateHeading = selectedDate
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
      }).format(selectedDate)
    : "Pick a date"
  const selectedDateKey = selectedDate ? dateKey(selectedDate) : null
  const selectedDaySlots = useMemo(() => (selectedDateKey ? slots.filter((slot) => zonedDateKey(slot.startsAt, timezone) === selectedDateKey) : []), [selectedDateKey, slots, timezone])
  const slotOptions = useMemo<WheelPickerOption<string>[]>(
    () =>
      selectedDaySlots.map((slot) => {
        const label = formatSlotTimeLabel(slot.startsAt, timezone, "12h")
        return {
          value: slot.id,
          label,
          textValue: label,
        }
      }),
    [selectedDaySlots, timezone]
  )
  const selectedSlotId = selectedSlot && selectedDaySlots.some((slot) => slot.id === selectedSlot.id) ? selectedSlot.id : slotOptions[0]?.value
  const availableDateKeys = useMemo(() => new Set(slots.map((slot) => zonedDateKey(slot.startsAt, timezone))), [slots, timezone])
  const availableCalendarDates = useMemo(
    () =>
      Array.from(availableDateKeys)
        .filter((key) => key !== selectedDateKey)
        .map(dateFromKey),
    [availableDateKeys, selectedDateKey]
  )
  const unavailableCalendarDates = useMemo(
    () =>
      listCalendarGridDates(calendarMonth).filter((date) => {
        const key = dateKey(date)
        return key !== selectedDateKey && !availableDateKeys.has(key)
      }),
    [availableDateKeys, calendarMonth, selectedDateKey]
  )
  const paidCheckoutRequired = initialData.creditSummary.available <= 0
  const checkoutUnavailable = paidCheckoutRequired && !initialData.paymentConfigured
  const { pending, confirmSelection, cancelBooking } = useCoachingBookingActions({
    selectedSlot, checkoutUnavailable, selectedCoachId: initialData.selectedCoachId,
    timezone, attendeeNotes, onBooked: () => {
      setCheckoutNoticeDismissed(true)
      setStep("done")
    },
    onUnavailable: () => {
      setSelectedSlot(null)
      setSlots([])
      setAvailabilityLoading(true)
      setAvailabilityRevision((revision) => revision + 1)
      setStep("time")
    },
  })
  const showCalendarStep = step === "date"
  const prefersReducedMotion = useReducedMotion()
  const stepTransition = {
    duration: prefersReducedMotion ? 0 : 0.22,
    ease: [0.22, 1, 0.36, 1],
  } as const
  const stepMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: stepDirection * 16, scale: 0.995 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: stepDirection * -12, scale: 0.997 },
      }
  const reviewMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      }

  useEffect(() => {
    const requestId = availabilityRequestId.current + 1
    availabilityRequestId.current = requestId

    if (!initialData.calendarConfigured) {
      setSlots([])
      setAvailabilityMessage("Coach calendars are not connected yet.")
      setAvailabilityLoading(false)
      return
    }

    const { from, to } = getCalendarGridRange(calendarMonth)
    setAvailabilityLoading(true)
    setAvailabilityMessage(null)
    setSlots([])

    void (async () => {
      const result = await listCoachingAvailabilityAction({
        coachId: initialData.selectedCoachId,
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
      })
      if (availabilityRequestId.current !== requestId) return

      if (!result.ok) {
        setAvailabilityMessage(result.error)
        setSlots([])
        setAvailabilityLoading(false)
        return
      }
      setAvailabilityMessage(result.calendarConfigured ? null : "Coach calendars are not connected yet.")
      setSlots(result.slots)
      setAvailabilityLoading(false)
    })()
  }, [calendarMonth, initialData.calendarConfigured, initialData.selectedCoachId, timezone, availabilityRevision])

  useEffect(() => {
    if (availabilityLoading) return

    if (!selectedDateKey || selectedDaySlots.length === 0) {
      setSelectedSlot(null)
      setStep((currentStep) => (currentStep === "review" ? "time" : currentStep))
      return
    }

    setSelectedSlot((currentSlot) => {
      if (currentSlot && selectedDaySlots.some((slot) => slot.id === currentSlot.id)) {
        return currentSlot
      }
      return selectedDaySlots[0] ?? null
    })
    setStep((currentStep) => (currentStep === "time" ? "review" : currentStep))
  }, [availabilityLoading, selectedDateKey, selectedDaySlots, step])

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date ?? undefined)
    if (date) {
      const nextMonth = startOfMonth(date)
      setCalendarMonth((currentMonth) => (currentMonth.getTime() === nextMonth.getTime() ? currentMonth : nextMonth))
      setStepDirection(1)
      setStep("time")
    } else {
      setStepDirection(-1)
      setStep("date")
    }
    setSelectedSlot(null)
  }

  function showCalendar() {
    setStepDirection(-1)
    setStep("date")
  }

  return (
    <main className="flex min-h-full flex-1 items-stretch justify-start px-0 py-0 sm:items-center sm:justify-center sm:px-4 sm:py-6 lg:px-6">
      <h1 className="sr-only">Coaching</h1>
      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-5 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:gap-6 sm:pb-0">
        {checkoutNotice ? <Alert role="status"><AlertDescription>{checkoutNotice}</AlertDescription></Alert> : null}
        <section className="border-border/70 bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="grid xl:grid-cols-[17.5rem_minmax(0,1fr)]">
            <SessionDetailsPanel coaches={initialData.coaches} creditSummary={initialData.creditSummary} timezone={timezone} />

            <section data-booking-scheduler-panel="true" className="border-border flex min-w-0 flex-col border-t px-4 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-3 xl:border-t-0 xl:border-l xl:px-6">
              <div className="mx-auto flex w-full max-w-[344px] flex-1 flex-col">
                <div data-booking-step-viewport="true" className="relative -mx-3 flex min-h-[22rem] flex-1 overflow-hidden px-3 sm:min-h-[23rem]">
                  <AnimatePresence initial={false} mode="wait" custom={stepDirection}>
                    {showCalendarStep ? (
                      <motion.div
                        key="calendar-step"
                        data-booking-calendar-panel="true"
                        className="flex min-w-0 flex-1 flex-col items-center justify-start will-change-transform"
                        initial={stepMotion.initial}
                        animate={stepMotion.animate}
                        exit={stepMotion.exit}
                        transition={stepTransition}
                      >
                        <div className="w-full min-w-0 max-w-[344px]">
                          <Calendar
                            mode="single"
                            fixedWeeks
                            month={calendarMonth}
                            onMonthChange={setCalendarMonth}
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            className="w-full p-0 [--cell-size:calc((100%_-_2.25rem)/7)]"
                            modifiers={{
                              available: availableCalendarDates,
                              unavailable: unavailableCalendarDates,
                            }}
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="time-step"
                        data-booking-time-panel="true"
                        className="flex min-w-0 flex-1 flex-col will-change-transform"
                        initial={stepMotion.initial}
                        animate={stepMotion.animate}
                        exit={stepMotion.exit}
                        transition={stepTransition}
                      >
                        <div className="flex min-w-0 flex-col">
                          {!availabilityLoading && slotOptions.length > 0 ? (
                            <div data-slot-wheel-area="true" className="mx-auto flex w-full max-w-[344px] flex-col gap-1.5">
                              <h3 className="text-foreground flex min-w-0 items-center gap-1 text-sm font-medium">
                                <span>Availability</span>
                                <span className="text-muted-foreground" aria-hidden>
                                  •
                                </span>
                                <span className="text-muted-foreground truncate">{selectedDateHeading}</span>
                              </h3>
                              <WheelPickerWrapper className="border-border/90 bg-card/60 w-full shadow-none">
                                <WheelPicker
                                  key={selectedDateKey ?? "no-date"}
                                  value={selectedSlotId}
                                  options={slotOptions}
                                  visibleCount={8}
                                  optionItemHeight={40}
                                  classNames={{
                                    optionItem: "text-base font-medium leading-none tabular-nums",
                                    highlightWrapper: "bg-muted/80 text-foreground",
                                    highlightItem: "text-base font-semibold leading-none tabular-nums",
                                  }}
                                  onValueChange={(slotId) => {
                                    const nextSlot = selectedDaySlots.find((slot) => slot.id === slotId)
                                    if (!nextSlot) return
                                    setSelectedSlot(nextSlot)
                                    setStep("review")
                                  }}
                                />
                              </WheelPickerWrapper>
                            </div>
                          ) : (
                            <div className="mx-auto flex w-full max-w-[344px] flex-col items-start gap-3">
                              <p className="text-muted-foreground text-sm">
                                {availabilityLoading
                                  ? "Checking times…"
                                  : formatAvailabilityMessage(availabilityMessage ?? (selectedDate ? "No open meetings on this date." : "Pick a date to see available times."))}
                              </p>
                              {!availabilityLoading ? (
                                <Button type="button" variant="outline" size="sm" className="rounded-full shadow-none" onClick={showCalendar}>
                                  <ChevronLeftIcon data-icon="inline-start" aria-hidden />
                                  Choose another day
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {!availabilityLoading && slotOptions.length > 0 ? <SessionNotesField value={attendeeNotes} disabled={pending} onChange={setAttendeeNotes} /> : null}

                        <div data-booking-review-footer="true" className="mt-auto pt-5">
                          <div data-booking-review-separator="true">
                            <Separator />
                          </div>
                          <div className="border-border/70 mt-5 flex min-h-24 flex-col justify-center overflow-hidden rounded-xl border px-4 py-4" aria-live="polite">
                            <AnimatePresence initial={false} mode="wait">
                              {step === "review" && selectedSlot ? (
                                <motion.div
                                  key={selectedSlot.id}
                                  className="flex flex-col items-center gap-4 text-center"
                                  initial={reviewMotion.initial}
                                  animate={reviewMotion.animate}
                                  exit={reviewMotion.exit}
                                  transition={stepTransition}
                                >
                                  <div className="flex flex-col items-center gap-3">
                                    <BookingParticipantStack coaches={initialData.coaches} currentUser={initialData.currentUser} />
                                    <div className="flex flex-col gap-1">
                                      <h2 className="text-sm font-medium">Confirm details</h2>
                                      <p className="text-muted-foreground text-sm">
                                        {formatDateTime(selectedSlot.startsAt, timezone)}
                                      </p>
                                    </div>
                                  </div>
                                  {checkoutUnavailable ? <p className="text-muted-foreground text-sm">Coaching checkout is not configured yet.</p> : null}
                                </motion.div>
                              ) : (
                                <motion.div key="empty-review" className="flex items-center gap-3" initial={reviewMotion.initial} animate={reviewMotion.animate} exit={reviewMotion.exit} transition={stepTransition}>
                                  <span className="bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full">
                                    <ClockIcon className="size-4" aria-hidden />
                                  </span>
                                  <div className="min-w-0 space-y-1">
                                    <h2 className="text-foreground text-sm font-medium">Choose a time</h2>
                                    <p className="text-muted-foreground text-sm">
                                      Pick an open meeting above to review the meeting details.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div data-booking-review-actions="true" className="mt-3 flex items-center justify-between gap-3">
                            <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 shrink-0 rounded-full px-3 shadow-none" onClick={showCalendar}>
                              Back
                            </Button>
                            <Button onClick={confirmSelection} disabled={pending || checkoutUnavailable || !selectedSlot} className="shrink-0">
                              Next
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          </div>
        </section>

        {initialData.upcomingBookings.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Upcoming</h2>
            </div>
            <div className="flex flex-col gap-2">
              {initialData.upcomingBookings.map((booking) => (
                <BookingRow key={booking.id} booking={booking} pending={pending} onCancel={() => cancelBooking(booking.id)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
