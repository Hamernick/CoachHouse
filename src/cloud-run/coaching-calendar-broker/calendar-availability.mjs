// Shared by the broker and direct adapter; no credentials or network calls here.
export function blockingCalendarIds(primary, additional = "") {
  if (!primary?.trim()) throw new Error("Coach calendar is not configured.")
  const ids = [...new Set([primary, ...additional.split(",")].map((id) => id.trim()).filter(Boolean))]
  if (ids.length > 50) throw new Error("Too many blocking calendars configured.")
  return ids
}

function validInstant(value) {
  return typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

export function validateBusyWindows(windows) {
  if (!Array.isArray(windows)) throw new Error("Google Calendar availability is incomplete.")
  for (const window of windows) {
    if (!validInstant(window?.startsAt) || !validInstant(window?.endsAt) || Date.parse(window.startsAt) >= Date.parse(window.endsAt)) {
      throw new Error("Google Calendar returned an invalid busy interval.")
    }
  }
  return windows
}

export function readCompleteFreeBusy(response, calendarIds) {
  if (!response || typeof response !== "object") throw new Error("Google Calendar availability is incomplete.")
  return calendarIds.flatMap((id) => {
    const calendar = response.calendars?.[id]
    if (!calendar || (calendar.errors !== undefined && (!Array.isArray(calendar.errors) || calendar.errors.length > 0)) || !Array.isArray(calendar.busy)) {
      throw new Error("Unable to verify every blocking calendar. Please try again shortly.")
    }
    return validateBusyWindows(calendar.busy.map((window) => ({ startsAt: window?.start, endsAt: window?.end })))
  })
}

export function eventIdentity(event, expectedId) {
  if (!event || event.id !== expectedId || !event.iCalUID || !event.organizer?.email || event.recurringEventId) {
    throw new Error("Unable to verify the existing calendar event identity.")
  }
  return { id: event.id, iCalUID: event.iCalUID, organizerEmail: event.organizer.email.toLowerCase() }
}

function isOwnEvent(event, identity) {
  return identity && event.iCalUID === identity.iCalUID && event.organizer?.email?.toLowerCase() === identity.organizerEmail && !event.recurringEventId
}

export function eventBusyWindow(event, { timeMin, timeMax, identity }) {
  if (!event || typeof event !== "object") throw new Error("Google Calendar event data is incomplete.")
  if (event.status === "cancelled" || event.transparency === "transparent" || event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === "declined")) return null
  if (isOwnEvent(event, identity)) return null
  const startsAt = event.start?.dateTime
  const endsAt = event.end?.dateTime
  // Google filters all-day events using their calendar timezone. Blocking the
  // queried overlap avoids interpreting date-only values as UTC midnight.
  if (event.start?.date && event.end?.date) return { startsAt: timeMin, endsAt: timeMax }
  const [window] = validateBusyWindows([{ startsAt, endsAt }])
  return Date.parse(window.startsAt) < Date.parse(timeMax) && Date.parse(window.endsAt) > Date.parse(timeMin) ? window : null
}

export async function listBlockingEventWindows({ request, calendarIds, coachId, timeMin, timeMax, identity }) {
  validateBusyWindows([{ startsAt: timeMin, endsAt: timeMax }])
  const windows = []
  for (const calendarId of calendarIds) {
    let pageToken
    const seen = new Set()
    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", showDeleted: "false", maxResults: "250" })
      if (pageToken) params.set("pageToken", pageToken)
      const response = await request({ coachId, path: `/calendars/${encodeURIComponent(calendarId)}/events?${params}` })
      if (!Array.isArray(response?.items) || response.accessRole === "freeBusyReader" || response.accessRole === "none") throw new Error("Unable to inspect blocking calendar events.")
      for (const event of response.items) {
        const window = eventBusyWindow(event, { timeMin, timeMax, identity })
        if (window) windows.push(window)
      }
      pageToken = response.nextPageToken
      if (!pageToken) break
      if (typeof pageToken !== "string" || seen.has(pageToken) || page === 9) throw new Error("Google Calendar event listing is incomplete.")
      seen.add(pageToken)
    }
  }
  return windows
}
