import type { CoachingCoachId } from "../types"
import { getCoachCalendarId, isBrokerConfigured, requestGoogleCalendarBroker, requestGoogleCalendarDirect } from "./google-calendar"

export type GoogleCoachingTitleEvent = {
  [key: string]: unknown
  id: string
  etag: string
  summary?: string
  status?: string
  organizer?: { email?: string; self?: boolean }
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  attendees?: Array<{ email?: string; responseStatus?: string; [key: string]: unknown }>
  hangoutLink?: string
  conferenceData?: unknown
  iCalUID?: string
}

type EventInput = { coachId: CoachingCoachId; googleEventId: string }
function eventPath({ coachId, googleEventId }: EventInput) {
  const calendarId = getCoachCalendarId(coachId)
  if (!calendarId) throw new Error("Coach calendar is not configured.")
  return `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`
}

export async function readGoogleCoachingEventForTitle(input: EventInput): Promise<GoogleCoachingTitleEvent> {
  const event = isBrokerConfigured()
    ? await requestGoogleCalendarBroker<GoogleCoachingTitleEvent>({ operation: "getEventForTitle", payload: input })
    : await requestGoogleCalendarDirect<GoogleCoachingTitleEvent>({ coachId: input.coachId, path: `${eventPath(input)}?conferenceDataVersion=1` })
  if (!event || event.id !== input.googleEventId || !event.etag) throw new Error("Unable to verify the calendar event before updating its title.")
  return event
}

export async function updateGoogleCoachingEventTitle(input: EventInput & { summary: string; etag: string; sendUpdates: "all" }): Promise<GoogleCoachingTitleEvent> {
  if (!input.etag || !input.summary.trim() || input.sendUpdates !== "all") throw new Error("A title update requires a current event version and attendee notifications.")
  if (isBrokerConfigured()) return requestGoogleCalendarBroker<GoogleCoachingTitleEvent>({ operation: "updateEventTitle", payload: input })
  await requestGoogleCalendarDirect<GoogleCoachingTitleEvent>({
    coachId: input.coachId,
    path: `${eventPath(input)}?conferenceDataVersion=1&sendUpdates=all`,
    method: "PATCH",
    requestHeaders: { "If-Match": input.etag },
    body: { summary: input.summary },
  })
  return readGoogleCoachingEventForTitle(input)
}
