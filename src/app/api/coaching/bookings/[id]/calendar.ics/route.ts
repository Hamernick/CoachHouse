import { NextRequest, NextResponse } from "next/server"

import { env } from "@/lib/env"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase"
import {
  buildCoachingCalendarTitle,
  loadCoachingClientName,
  getGoogleCoachingParticipantEmail,
  COACHING_JOINT_COACH_IDS,
  COACHING_JOINT_COACH_LABEL,
  COACHING_JOINT_PRIMARY_COACH_ID,
  COACHING_PATH,
  COACHING_SESSION_MINUTES,
  escapeIcsText,
  formatIcsDate,
  getValidGoogleCalendarEventUrl,
  getValidGoogleMeetUrl,
} from "@/features/coaching-booking"

const CANONICAL_SITE_URL = "https://coachhouse.app"
const ICS_LINE_LIMIT = 75
const ICS_FILENAME_PREFIX = "coach-house-advisory-meeting"
const COACHING_PARTICIPANT_NAMES = {
  joel: "Joel",
  paula: "Paula",
} as const

function isLocalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
  } catch {
    return false
  }
}

function resolveSiteUrl(request: NextRequest) {
  const candidates = [env.NEXT_PUBLIC_SITE_URL, env.NEXT_PUBLIC_APP_URL, request.nextUrl.origin]

  for (const candidate of candidates) {
    const normalized = candidate?.trim().replace(/\/+$/, "")
    if (normalized && !isLocalUrl(normalized)) return normalized
  }

  return CANONICAL_SITE_URL
}

function foldIcsLine(line: string) {
  if (line.length <= ICS_LINE_LIMIT) return line

  const chunks = [line.slice(0, ICS_LINE_LIMIT)]
  let remaining = line.slice(ICS_LINE_LIMIT)
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, ICS_LINE_LIMIT - 1)}`)
    remaining = remaining.slice(ICS_LINE_LIMIT - 1)
  }
  return chunks.join("\r\n")
}

function escapeIcsParam(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.includes("@") ? normalized : null
}

function buildIcsAttendeeLines({
  attendeeEmail,
  coachEmails,
}: {
  attendeeEmail: string | null | undefined
  coachEmails: Array<{ name: string; email: string | null }>
}) {
  const seen = new Set<string>()
  const participants = [
    ...coachEmails.map((coach) => ({ name: coach.name, email: normalizeEmail(coach.email) })),
    { name: "Attendee", email: normalizeEmail(attendeeEmail) },
  ].filter((participant): participant is { name: string; email: string } => Boolean(participant.email))

  return participants.flatMap((participant) => {
    const key = participant.email.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [
      `ATTENDEE;CN="${escapeIcsParam(participant.name)}";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${escapeIcsText(participant.email)}`,
    ]
  })
}

function buildIcsOrganizerLine(email: string | null) {
  const organizerEmail = normalizeEmail(email)
  return organizerEmail
    ? `ORGANIZER;CN="${escapeIcsParam("Coach House")}":mailto:${escapeIcsText(organizerEmail)}`
    : null
}

function buildIcsDescription({
  googleMeetUrl,
  googleEventHtmlLink,
  attendeeNotes,
  coachingUrl,
}: {
  googleMeetUrl: string | null
  googleEventHtmlLink: string | null
  attendeeNotes: string | null
  coachingUrl: string
}) {
  return [
    `Coach House advisory meeting with ${COACHING_JOINT_COACH_LABEL}.`,
    "",
    `Duration: ${COACHING_SESSION_MINUTES} minutes`,
    ...(googleMeetUrl ? [`Google Meet: ${googleMeetUrl}`] : []),
    ...(googleEventHtmlLink ? [`Google Calendar invite: ${googleEventHtmlLink}`] : []),
    `Manage meeting: ${coachingUrl}`,
    "",
    "Use the Google Calendar invite for updates or rescheduling.",
    ...(attendeeNotes?.trim() ? ["", `Meeting notes: ${attendeeNotes.trim()}`] : []),
  ].join("\n")
}

function buildIcsDownloadFilename(startsAt: string, timeZone: string) {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return `${ICS_FILENAME_PREFIX}.ics`

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((entry) => entry.type === type)?.value ?? ""
    const year = part("year")
    const month = part("month")
    const day = part("day")
    const hour = part("hour").padStart(2, "0")
    const minute = part("minute")
    const dayPeriod = part("dayPeriod").toLowerCase()

    if (year && month && day && hour && minute && dayPeriod) {
      return `${ICS_FILENAME_PREFIX}-${year}-${month}-${day}-${hour}-${minute}-${dayPeriod}.ics`
    }
  } catch {
    // Fall back to UTC below if the stored timezone cannot be formatted.
  }

  return `${ICS_FILENAME_PREFIX}-${date.toISOString().slice(0, 16).replace(/[:T]/g, "-")}-utc.ics`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const { id } = await params
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: booking, error } = await supabase
    .from("coaching_bookings")
    .select("id, user_id, starts_at, ends_at, timezone, attendee_notes, google_meet_url, google_event_html_link")
    .eq("id", id)
    .maybeSingle<{
      id: string
      user_id: string
      starts_at: string
      ends_at: string
      timezone: string
      attendee_notes: string | null
      google_meet_url: string | null
      google_event_html_link: string | null
    }>()

  if (error) {
    return NextResponse.json({ error: "Unable to load booking." }, { status: 500 })
  }
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const clientName = await loadCoachingClientName({ supabase, userId: booking.user_id })
  const googleMeetUrl = getValidGoogleMeetUrl(booking.google_meet_url)
  const googleEventHtmlLink = getValidGoogleCalendarEventUrl(booking.google_event_html_link)
  const siteUrl = resolveSiteUrl(request)
  const coachingUrl = `${siteUrl}${COACHING_PATH}`
  const eventUrl = googleMeetUrl ?? googleEventHtmlLink ?? coachingUrl
  const downloadFilename = buildIcsDownloadFilename(booking.starts_at, booking.timezone)
  const coachAttendees = COACHING_JOINT_COACH_IDS.map((coachId) => ({
    name: COACHING_PARTICIPANT_NAMES[coachId],
    email: getGoogleCoachingParticipantEmail(coachId),
  }))
  const organizerLine = buildIcsOrganizerLine(getGoogleCoachingParticipantEmail(COACHING_JOINT_PRIMARY_COACH_ID))
  const description = buildIcsDescription({
    googleMeetUrl,
    googleEventHtmlLink,
    attendeeNotes: booking.attendee_notes,
    coachingUrl,
  })
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coach House//Coaching//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "NAME:Coach House Coaching",
    "X-WR-CALNAME:Coach House Coaching",
    "BEGIN:VEVENT",
    `UID:${booking.id}@coachhouse.app`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatIcsDate(booking.starts_at)}`,
    `DTEND:${formatIcsDate(booking.ends_at)}`,
    `SUMMARY:${escapeIcsText(buildCoachingCalendarTitle(clientName))}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "CATEGORIES:Coach House,Coaching",
    ...(organizerLine ? [organizerLine] : []),
    ...buildIcsAttendeeLines({ attendeeEmail: user.email, coachEmails: coachAttendees }),
    ...(booking.timezone ? [`X-COACH-HOUSE-TIMEZONE:${escapeIcsText(booking.timezone)}`] : []),
    ...(googleMeetUrl
      ? [
          "LOCATION:Google Meet",
          `CONFERENCE;VALUE=URI;FEATURE=AUDIO,VIDEO;LABEL="Google Meet":${escapeIcsText(googleMeetUrl)}`,
        ]
      : ["LOCATION:Online"]),
    `URL:${escapeIcsText(eventUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return new NextResponse(`${lines.map(foldIcsLine).join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${downloadFilename}"`,
    },
  })
}
