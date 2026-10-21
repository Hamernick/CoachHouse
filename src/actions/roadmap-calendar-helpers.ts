import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { createNotification } from "@/lib/notifications"
import {
  clearBoardMeetingReminderNotificationsForEvent,
  syncBoardMeetingReminderNotificationsForEvent,
} from "../features/board-notifications/server/actions"
import {
  normalizeAssignedRoles,
  normalizeEventType,
  normalizeRecurrence,
  type RoadmapCalendarAssignedRole,
  type RoadmapCalendarEvent,
  type RoadmapCalendarEventInput,
  type RoadmapCalendarEventType,
  type RoadmapCalendarRecurrence,
  type RoadmapCalendarType,
} from "@/lib/roadmap/calendar"

export const CALENDAR_TABLES = {
  public: {
    events: "roadmap_calendar_public_events",
    feeds: "roadmap_calendar_public_feeds",
  },
  internal: {
    events: "roadmap_calendar_internal_events",
    feeds: "roadmap_calendar_internal_feeds",
  },
} as const

export type CalendarListResult =
  | { ok: true; orgId: string; events: RoadmapCalendarEvent[]; canManageCalendar: boolean }
  | { error: string }

export type CalendarWriteResult =
  | { ok: true; event: RoadmapCalendarEvent }
  | { error: string }

export type CalendarDeleteResult = { ok: true } | { error: string }

export type FeedTokenResult =
  | {
      ok: true
      publicToken: string
      internalToken: string
    }
  | { error: string }

export type FeedRotateResult = { ok: true; token: string } | { error: string }

export async function resolveCalendarAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { orgId, role } = await resolveActiveOrganization(supabase, userId)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>()
  const isPlatformAdmin = profileRow?.role === "admin"
  let canManageCalendar =
    isPlatformAdmin || role === "owner" || role === "admin"

  if (!isPlatformAdmin && role === "staff") {
    const { data: settingsRow } = await supabase
      .from("organization_access_settings")
      .select("staff_can_manage_calendar")
      .eq("org_id", orgId)
      .maybeSingle<{ staff_can_manage_calendar: boolean }>()
    canManageCalendar = Boolean(settingsRow?.staff_can_manage_calendar)
  }

  return { orgId, role, canManageCalendar }
}

export function createFeedToken() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replace(/-/g, "")
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    )
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
}

type CalendarInputResult =
  | { ok: false; error: string }
  | {
      ok: true
      title: string
      description: string | null
      eventType: RoadmapCalendarEventType
      startsAt: string
      endsAt: string | null
      allDay: boolean
      recurrence: RoadmapCalendarRecurrence | null
      status: "active" | "canceled"
      assignedRoles: RoadmapCalendarAssignedRole[]
    }

export function normalizeCalendarInput(
  input: RoadmapCalendarEventInput
): CalendarInputResult {
  const title = input.title?.trim()
  if (!title) return { ok: false, error: "Event title is required." }

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Start date is invalid." }
  }

  const endsAt = input.endsAt ? new Date(input.endsAt) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: "End date is invalid." }
  }
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "End date must be after the start date." }
  }

  const assignedRoles = normalizeAssignedRoles(input.assignedRoles)
  const recurrence = normalizeRecurrence(input.recurrence)

  return {
    ok: true,
    title,
    description: input.description?.trim() ?? null,
    eventType: normalizeEventType(input.eventType),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    allDay: Boolean(input.allDay),
    recurrence,
    status: input.status === "canceled" ? "canceled" : "active",
    assignedRoles:
      assignedRoles.length > 0
        ? assignedRoles
        : (["admin"] as RoadmapCalendarAssignedRole[]),
  }
}

export async function notifyCalendarChange({
  orgId,
  actorId,
  calendarType,
  action,
  event,
}: {
  orgId: string
  actorId: string
  calendarType: RoadmapCalendarType
  action: "created" | "updated" | "deleted"
  event: RoadmapCalendarEvent
}) {
  let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null
  try {
    adminClient = createSupabaseAdminClient()
  } catch {
    adminClient = null
  }

  if (!adminClient) return

  const { data: members } = await adminClient
    .from("organization_memberships")
    .select("member_id, role")
    .eq("org_id", orgId)
    .in("role", ["admin", "staff"])
    .returns<Array<{ member_id: string; role: string }>>()

  const { data: settingsRow } = await adminClient
    .from("organization_access_settings")
    .select("staff_can_manage_calendar")
    .eq("org_id", orgId)
    .maybeSingle<{ staff_can_manage_calendar: boolean }>()

  const allowedStaff = Boolean(settingsRow?.staff_can_manage_calendar)

  const recipientIds = new Set<string>([orgId])
  for (const member of members ?? []) {
    if (member.role === "admin") {
      recipientIds.add(member.member_id)
    }
    if (member.role === "staff" && allowedStaff) {
      recipientIds.add(member.member_id)
    }
  }

  const title = `Calendar event ${action}`
  const description = `${event.title} was ${action}.`

  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      createNotification(adminClient!, {
        userId,
        title,
        description,
        href: "/roadmap",
        tone: action === "deleted" ? "warning" : "info",
        type: `roadmap_calendar_${action}`,
        actorId,
        orgId,
        metadata: {
          eventId: event.id,
          calendarType,
        },
      })
    )
  )

  if (calendarType !== "internal" || event.eventType !== "board_meeting") {
    return
  }

  try {
    if (action === "deleted" || event.status === "canceled") {
      await clearBoardMeetingReminderNotificationsForEvent({
        eventId: event.id,
        orgId,
        supabase: adminClient,
      })
      return
    }

    if (action === "updated") {
      await clearBoardMeetingReminderNotificationsForEvent({
        eventId: event.id,
        orgId,
        supabase: adminClient,
      })
    }

    await syncBoardMeetingReminderNotificationsForEvent({
      event,
      supabase: adminClient,
    })
  } catch (error) {
    console.error("Failed to sync board meeting reminder notifications", error)
  }
}

export async function ensureFeedToken({
  supabase,
  orgId,
  calendarType,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  orgId: string
  calendarType: RoadmapCalendarType
}): Promise<{ token: string } | { error: string }> {
  const table = CALENDAR_TABLES[calendarType].feeds
  const { data: existing } = await supabase
    .from(table)
    .select("token")
    .eq("org_id", orgId)
    .maybeSingle<{ token: string }>()

  if (existing?.token) return { token: existing.token }

  const token = createFeedToken()
  const { data, error } = await supabase
    .from(table)
    .insert({ org_id: orgId, token })
    .select("token")
    .maybeSingle<{ token: string }>()

  if (error || !data)
    return { error: error?.message ?? "Unable to create feed token." }
  return { token: data.token }
}
