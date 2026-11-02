import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const CALENDAR_TABLES = {
  public: {
    label: "Roadmap Calendar (Public)",
  },
  internal: {
    label: "Roadmap Calendar (Internal)",
  },
} as const

type CalendarType = keyof typeof CALENDAR_TABLES
const timestamp = z.string().refine((value) => Number.isFinite(new Date(value).getTime()))
const calendarEvents = z.array(z.object({
  id: z.string().uuid(), title: z.string(), description: z.string().nullable(),
  event_type: z.string().nullable(), starts_at: timestamp, ends_at: timestamp.nullable(),
  all_day: z.boolean(), status: z.literal("active"), updated_at: timestamp,
}).strict())

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function formatIcsDateTime(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function formatIcsDateOnly(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, "")
}

export async function readCalendarFeed(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim()
  const typeParam = searchParams.get("type")?.trim() ?? "public"

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 })
  }

  if (typeParam !== "public" && typeParam !== "internal") {
    return NextResponse.json({ error: "Invalid calendar type." }, { status: 400 })
  }

  const type = typeParam as CalendarType
  const admin = createSupabaseAdminClient()

  const rpc = admin.rpc.bind(admin) as unknown as (
    name: "read_roadmap_calendar_feed",
    args: { p_token: string; p_type: CalendarType },
  ) => PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await rpc("read_roadmap_calendar_feed", { p_token: token, p_type: type })
  if (error) return NextResponse.json({ error: "Calendar temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  if (data === null) return NextResponse.json({ error: "Feed not found." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  const parsed = calendarEvents.safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: "Calendar temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const events = parsed.data

  const now = formatIcsDateTime(new Date())
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coach House//Roadmap Calendar//EN",
    `X-WR-CALNAME:${escapeIcsText(CALENDAR_TABLES[type].label)}`,
    "CALSCALE:GREGORIAN",
  ]

  for (const event of events ?? []) {
    const start = new Date(event.starts_at)
    const end = event.ends_at ? new Date(event.ends_at) : null
    const eventStart = event.all_day ? formatIcsDateOnly(start) : formatIcsDateTime(start)
    const eventEnd = event.all_day
      ? formatIcsDateOnly(new Date(start.getTime() + 24 * 60 * 60 * 1000))
      : formatIcsDateTime(end ?? new Date(start.getTime() + 60 * 60 * 1000))

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${event.id}@coachhouse`)
    lines.push(`DTSTAMP:${now}`)
    if (event.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${eventStart}`)
      lines.push(`DTEND;VALUE=DATE:${eventEnd}`)
    } else {
      lines.push(`DTSTART:${eventStart}`)
      lines.push(`DTEND:${eventEnd}`)
    }
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`)
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
    }
    if (event.event_type) {
      lines.push(`CATEGORIES:${escapeIcsText(event.event_type)}`)
    }
    if (event.updated_at) {
      lines.push(`LAST-MODIFIED:${formatIcsDateTime(new Date(event.updated_at))}`)
    }
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
