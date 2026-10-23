import { addMinutes, COACHING_DEFAULT_TIMEZONE, COACHING_SESSION_MINUTES, toSlotId } from "."
import type { CoachingCoachId, CoachingSlot } from "../types"

type BusyWindow = {
  startsAt: string
  endsAt: string
}

const FULL_DAY_START_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
const SLOT_START_HOURS_BY_WEEKDAY: Record<number, readonly number[]> = {
  0: [],
  1: FULL_DAY_START_HOURS,
  2: FULL_DAY_START_HOURS,
  3: [9, 10, 11, 12, 13, 14, 15, 16],
  4: FULL_DAY_START_HOURS,
  5: [],
  6: [10, 11, 12],
}

export function isCoachingSlotWithinSchedule(startsAt: Date, endsAt?: Date) {
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getUTCMilliseconds() !== 0) return false
  if (endsAt && endsAt.getTime() - startsAt.getTime() !== COACHING_SESSION_MINUTES * 60_000) return false
  const local = getTimezoneParts(startsAt, COACHING_DEFAULT_TIMEZONE)
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()
  return local.minute === 0 && local.second === 0 && SLOT_START_HOURS_BY_WEEKDAY[weekday].includes(local.hour)
}

function overlaps(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && rightStart < leftEnd
}

function getTimezoneParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour === "24" ? "0" : byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  }
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const parts = getTimezoneParts(date, timezone)
  const utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return utc - date.getTime()
}

export function localDateTimeToUtc({
  date,
  hour,
  timezone,
}: {
  date: Date
  hour: number
  timezone: string
}) {
  const localCandidate = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    0,
    0,
  )
  let candidate = new Date(localCandidate)
  // Re-evaluate the offset at the converted instant so DST on this date is used.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const corrected = new Date(localCandidate - getTimezoneOffsetMs(candidate, timezone))
    if (corrected.getTime() === candidate.getTime()) return corrected
    candidate = corrected
  }
  return candidate
}

export function buildCandidateSlots({
  coachId,
  from,
  to,
  timezone,
  busyWindows,
}: {
  coachId: CoachingCoachId
  from: Date
  to: Date
  timezone: string
  busyWindows: BusyWindow[]
}): CoachingSlot[] {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return []
  const fromLocal = getTimezoneParts(from, COACHING_DEFAULT_TIMEZONE)
  const toLocal = getTimezoneParts(to, COACHING_DEFAULT_TIMEZONE)
  const dateCursor = new Date(Date.UTC(fromLocal.year, fromLocal.month - 1, fromLocal.day))
  const endDate = new Date(Date.UTC(toLocal.year, toLocal.month - 1, toLocal.day))
  const busy = busyWindows.map((window) => ({
    startsAt: new Date(window.startsAt),
    endsAt: new Date(window.endsAt),
  }))
  const now = new Date()
  const slots: CoachingSlot[] = []

  while (dateCursor <= endDate) {
    const weekday = dateCursor.getUTCDay()
    for (const hour of SLOT_START_HOURS_BY_WEEKDAY[weekday]) {
      const startsAt = localDateTimeToUtc({ date: dateCursor, hour, timezone: COACHING_DEFAULT_TIMEZONE })
      const endsAt = addMinutes(startsAt, COACHING_SESSION_MINUTES)
      if (startsAt <= now || startsAt < from || startsAt > to) continue
      const blocked = busy.some((window) => overlaps(startsAt, endsAt, window.startsAt, window.endsAt))
      slots.push({
        id: toSlotId(coachId, startsAt.toISOString()),
        coachId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        dateLabel: new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: timezone,
        }).format(startsAt),
        timeLabel: new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone,
        }).format(startsAt),
        available: !blocked,
      })
    }
    dateCursor.setUTCDate(dateCursor.getUTCDate() + 1)
  }

  return slots
}
