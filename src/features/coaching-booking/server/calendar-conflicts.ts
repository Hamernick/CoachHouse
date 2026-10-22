import { env } from "@/lib/env"
import {
  blockingCalendarIds,
  eventIdentity,
  listBlockingEventWindows,
  readCompleteFreeBusy,
  validateBusyWindows,
} from "../../../cloud-run/coaching-calendar-broker/calendar-availability.mjs"
import { COACHING_JOINT_COACH_IDS, COACHING_JOINT_PRIMARY_COACH_ID } from "../lib"
import type { CoachingCoachId } from "../types"
import {
  getCoachCalendarId,
  isBrokerConfigured,
  requestGoogleCalendarBroker,
  requestGoogleCalendarDirect,
} from "./google-calendar"

type BusyWindow = { startsAt: string; endsAt: string }
type AvailabilityInput = {
  coachId: CoachingCoachId
  timeMin: string
  timeMax: string
  excludeGoogleEventId?: string
}

export class CoachingCalendarConflictError extends Error {
  readonly code = "COACHING_SLOT_UNAVAILABLE"
  constructor() {
    super("That slot was just taken. Pick another time.")
    this.name = "CoachingCalendarConflictError"
  }
}

export async function listGoogleBusyWindows({ coachId, timeMin, timeMax, excludeGoogleEventId }: AvailabilityInput): Promise<BusyWindow[]> {
  validateBusyWindows([{ startsAt: timeMin, endsAt: timeMax }])
  if (isBrokerConfigured()) {
    const response = await requestGoogleCalendarBroker<{ busy?: BusyWindow[]; availabilityVersion?: number }>({
      operation: "freeBusy",
      payload: { coachId, timeMin, timeMax, excludeGoogleEventId },
    })
    if (response.availabilityVersion !== 2) throw new Error("Calendar availability verification is temporarily unavailable.")
    return validateBusyWindows(response.busy)
  }
  const additional = coachId === "paula" ? env.GOOGLE_COACHING_PAULA_BLOCKING_CALENDAR_IDS : env.GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS
  const calendarIds = blockingCalendarIds(getCoachCalendarId(coachId), additional)
  let identity
  if (excludeGoogleEventId) {
    const organizerCalendar = getCoachCalendarId(COACHING_JOINT_PRIMARY_COACH_ID)
    if (!organizerCalendar) throw new Error("Coach calendar is not configured.")
    try {
      const event = await requestGoogleCalendarDirect({
        coachId: COACHING_JOINT_PRIMARY_COACH_ID,
        path: `/calendars/${encodeURIComponent(organizerCalendar)}/events/${encodeURIComponent(excludeGoogleEventId)}`,
      })
      identity = eventIdentity(event, excludeGoogleEventId)
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error
    }
  }
  if (identity) {
    return listBlockingEventWindows({ request: requestGoogleCalendarDirect, calendarIds, coachId, timeMin, timeMax, identity })
  }
  const response = await requestGoogleCalendarDirect({
    coachId,
    path: "/freeBusy",
    method: "POST",
    body: { timeMin, timeMax, items: calendarIds.map((id) => ({ id })) },
  })
  return readCompleteFreeBusy(response, calendarIds)
}

export async function assertCoachingCalendarAvailable({ startsAt, endsAt, excludeGoogleEventId }: { startsAt: string; endsAt: string; excludeGoogleEventId?: string }) {
  const windows = (await Promise.all(COACHING_JOINT_COACH_IDS.map((coachId) => listGoogleBusyWindows({
    coachId, timeMin: startsAt, timeMax: endsAt, excludeGoogleEventId,
  })))).flat()
  if (windows.some((window) => Date.parse(window.startsAt) < Date.parse(endsAt) && Date.parse(window.endsAt) > Date.parse(startsAt))) {
    throw new CoachingCalendarConflictError()
  }
}
