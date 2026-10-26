import type { CompanionSnapshot } from "../types"

type Event = NonNullable<CompanionSnapshot["calendar"]["event"]>

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,")
}

// RFC 5545 lines are limited to 75 octets, not 75 JavaScript characters.
function foldLine(line: string) {
  const lines: string[] = []
  let current = ""
  let bytes = 0
  for (const character of line) {
    const size = new TextEncoder().encode(character).length
    if (bytes + size > 75) {
      lines.push(current)
      current = " "
      bytes = 1
    }
    current += character
    bytes += size
  }
  lines.push(current)
  return lines.join("\r\n")
}

function instant(value: string) {
  // Require an explicit offset; host-local interpretation is never acceptable.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Use an ISO timestamp with seconds and an explicit timezone offset.")
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid event date.")
  const [hour, minute, second] = value.slice(11, 19).split(":").map(Number)
  if (hour > 23 || minute > 59 || second > 59) throw new Error("Invalid event time.")
  const calendarDate = value.slice(0, 10)
  const [year, month, day] = calendarDate.split("-").map(Number)
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== calendarDate) {
    throw new Error("Invalid calendar date.")
  }
  return date
}

export function buildCompanionCalendarExport(input: {
  id: string; title: string; startsAt: string; endsAt: string; timeZone: string; now: string
}): Event {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(input.id)) throw new Error("Invalid event identifier.")
  const title = input.title.trim()
  if (!title || title.length > 180 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(title)) {
    throw new Error("Use an event title between 1 and 180 characters.")
  }
  if (!input.timeZone || input.timeZone.length > 80 || !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(input.timeZone)) throw new Error("Choose a valid timezone.")
  try { new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone }).format() }
  catch { throw new Error("Choose a valid IANA timezone.") }
  const start = instant(input.startsAt)
  const end = instant(input.endsAt)
  const duration = end.getTime() - start.getTime()
  if (duration <= 0 || duration > 24 * 60 * 60 * 1000) throw new Error("The end must follow the start by at most 24 hours.")
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Coach House//Companion Sandbox//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${input.id}@companion.coachhouse.app`, `DTSTAMP:${stamp(new Date(input.now))}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(`Coach House sandbox work block. Display timezone: ${input.timeZone}. Import this file to add it to your calendar.`)}`,
    "END:VEVENT", "END:VCALENDAR",
  ]
  return { id: input.id, title, startsAt: start.toISOString(), endsAt: end.toISOString(), timeZone: input.timeZone,
    status: "export_ready", ics: lines.map(foldLine).join("\r\n") + "\r\n" }
}
