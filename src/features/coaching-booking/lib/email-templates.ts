import { buildCoachingCalendarTitle } from "./calendar-title"
import { renderMinimalEmail } from "@/lib/email/minimal-template"
import { COACHING_JOINT_COACH_LABEL, COACHING_PATH, getValidGoogleCalendarEventUrl, getValidGoogleMeetUrl } from "./index"

export type CoachingBookingEmailInput = {
  audience: "attendee" | "coach"
  siteUrl: string
  attendeeName?: string | null
  attendeeEmail: string | null
  startsAt: string
  endsAt: string
  timezone: string
  googleEventHtmlLink: string | null
  googleMeetUrl: string | null
  attendeeNotes?: string | null
}

export function buildCoachingBookingEmail(input: CoachingBookingEmailInput) {
  const coach = input.audience === "coach"
  const start = new Date(input.startsAt)
  const end = new Date(input.endsAt)
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: input.timezone }).format(start)
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: input.timezone, timeZoneName: "short" })
  const when = `${date}, ${time.format(start)} to ${time.format(end)}`
  const calendarUrl = getValidGoogleCalendarEventUrl(input.googleEventHtmlLink)
  const meetUrl = getValidGoogleMeetUrl(input.googleMeetUrl)
  const coachingUrl = `${input.siteUrl.replace(/\/+$/, "")}${COACHING_PATH}`
  const notes = input.attendeeNotes?.trim()
  const subject = coach ? "New Coach House coaching meeting booked" : "Your Coach House coaching meeting is confirmed"
  return {
    subject,
    ...renderMinimalEmail({
      siteUrl: input.siteUrl,
      eyebrow: "Coaching",
      title: coach ? "New coaching meeting booked" : "Your coaching meeting is confirmed",
      intro: coach ? "A Coach House coaching meeting has been confirmed." : "Your Coach House coaching meeting has been booked.",
      details: [
        { label: "Meeting", value: buildCoachingCalendarTitle(input.attendeeName) },
        { label: "When", value: when },
        { label: "Timezone", value: input.timezone },
        ...(coach && input.attendeeEmail ? [{ label: "Attendee", value: input.attendeeEmail }] : []),
      ],
      sections: notes ? [{ title: "Notes", body: [notes] }] : [],
      action: { label: "Open Coaching", href: coachingUrl },
      links: [
        ...(calendarUrl ? [{ label: "Open Google Calendar invite", href: calendarUrl }] : []),
        ...(meetUrl ? [{ label: "Join Google Meet", href: meetUrl }] : []),
      ],
      previewText: `${when} with ${COACHING_JOINT_COACH_LABEL}.`,
    }),
  }
}
