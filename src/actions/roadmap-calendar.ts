"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { readWorkspaceParticleCalendar } from "@/server/workspace-particle-calendar"
import { particleCalendarEventsInRange } from "@/features/workspace-particles"
import {
  mapCalendarRow,
  normalizeEventType,
  normalizeAssignedRoles,
  type RoadmapCalendarEventInput,
  type RoadmapCalendarEvent,
  type RoadmapCalendarEventUpdate,
  type RoadmapCalendarRecurrence,
  type RoadmapCalendarType,
} from "@/lib/roadmap/calendar"
import {
  CALENDAR_TABLES,
  createFeedToken,
  ensureFeedToken,
  normalizeCalendarInput,
  notifyCalendarChange,
  resolveCalendarAccess,
  type CalendarDeleteResult,
  type CalendarListResult,
  type CalendarWriteResult,
  type FeedRotateResult,
  type FeedTokenResult,
} from "@/actions/roadmap-calendar-helpers"

export async function listRoadmapCalendarEvents({
  calendarType,
  from,
  to,
}: {
  calendarType: RoadmapCalendarType
  from?: string | null
  to?: string | null
}): Promise<CalendarListResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  const table = CALENDAR_TABLES[calendarType].events

  let query = supabase
    .from(table)
    .select(
      "id,org_id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .order("starts_at", { ascending: true })

  if (to) {
    query = query.lte("starts_at", to)
  }
  if (from) {
    query = query.or(
      `ends_at.gte.${from},and(ends_at.is.null,starts_at.gte.${from}),recurrence.not.is.null`
    )
  }

  const { data, error: listError } = await query

  if (listError) return { error: listError.message }

  let workspaceEvents: RoadmapCalendarEvent[] = []
  if (calendarType === "internal") {
    try {
      workspaceEvents = particleCalendarEventsInRange(await readWorkspaceParticleCalendar(supabase, orgId), from, to)
    } catch {
      return { error: "Unable to load workspace events. Try again." }
    }
  }

  return {
    ok: true,
    orgId,
    events: [...(data ?? []).map(mapCalendarRow), ...workspaceEvents]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)),
    canManageCalendar,
  }
}

export async function createRoadmapCalendarEvent({
  calendarType,
  event,
}: {
  calendarType: RoadmapCalendarType
  event: RoadmapCalendarEventInput
}): Promise<CalendarWriteResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  if (!canManageCalendar) return { error: "Forbidden." }

  const normalized = normalizeCalendarInput(event)
  if (!normalized.ok) return { error: normalized.error }

  const table = CALENDAR_TABLES[calendarType].events

  const { data, error: insertError } = await supabase
    .from(table)
    .insert({
      org_id: orgId,
      title: normalized.title,
      description: normalized.description,
      event_type: normalized.eventType,
      starts_at: normalized.startsAt,
      ends_at: normalized.endsAt,
      all_day: normalized.allDay,
      recurrence: normalized.recurrence,
      status: normalized.status,
      assigned_roles: normalized.assignedRoles,
    })
    .select(
      "id,org_id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,created_at,updated_at"
    )
    .maybeSingle()

  if (insertError || !data) {
    return { error: insertError?.message ?? "Unable to create event." }
  }

  const mapped = mapCalendarRow(data)
  await notifyCalendarChange({
    orgId,
    actorId: user.id,
    calendarType,
    action: "created",
    event: mapped,
  })

  return { ok: true, event: mapped }
}

export async function updateRoadmapCalendarEvent({
  calendarType,
  eventId,
  updates,
}: {
  calendarType: RoadmapCalendarType
  eventId: string
  updates: RoadmapCalendarEventUpdate
}): Promise<CalendarWriteResult> {
  if (eventId.startsWith("particle:"))
    return { error: "Edit this Event in its workspace Particle." }
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  if (!canManageCalendar) return { error: "Forbidden." }

  const table = CALENDAR_TABLES[calendarType].events

  const { data: existing } = await supabase
    .from(table)
    .select(
      "id,org_id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .eq("id", eventId)
    .maybeSingle()

  if (!existing) return { error: "Event not found." }
  if (
    updates.expectedUpdatedAt &&
    updates.expectedUpdatedAt !== existing.updated_at
  ) {
    return {
      error: "This calendar event was updated elsewhere. Reload before saving.",
    }
  }

  const normalized = normalizeCalendarInput({
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    eventType: updates.eventType ?? normalizeEventType(existing.event_type),
    startsAt: updates.startsAt ?? existing.starts_at,
    endsAt: updates.endsAt ?? existing.ends_at,
    allDay: updates.allDay ?? existing.all_day,
    recurrence:
      updates.recurrence ??
      (existing.recurrence as RoadmapCalendarRecurrence | null),
    status:
      updates.status ??
      (existing.status === "canceled" ? "canceled" : "active"),
    assignedRoles:
      updates.assignedRoles ??
      normalizeAssignedRoles(existing.assigned_roles ?? []),
  })

  if (!normalized.ok) return { error: normalized.error }

  const { data, error: updateError } = await supabase
    .from(table)
    .update({
      title: normalized.title,
      description: normalized.description,
      event_type: normalized.eventType,
      starts_at: normalized.startsAt,
      ends_at: normalized.endsAt,
      all_day: normalized.allDay,
      recurrence: normalized.recurrence,
      status: normalized.status,
      assigned_roles: normalized.assignedRoles,
    })
    .eq("org_id", orgId)
    .eq("id", eventId)
    .eq("updated_at", existing.updated_at)
    .select(
      "id,org_id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,created_at,updated_at"
    )
    .maybeSingle()

  if (updateError) {
    return { error: updateError.message }
  }
  if (!data) {
    return {
      error: "This calendar event was updated elsewhere. Reload before saving.",
    }
  }

  const mapped = mapCalendarRow(data)
  await notifyCalendarChange({
    orgId,
    actorId: user.id,
    calendarType,
    action: "updated",
    event: mapped,
  })

  return { ok: true, event: mapped }
}

export async function deleteRoadmapCalendarEvent({
  calendarType,
  eventId,
}: {
  calendarType: RoadmapCalendarType
  eventId: string
}): Promise<CalendarDeleteResult> {
  if (eventId.startsWith("particle:"))
    return { error: "Delete this Event from its workspace Particle." }
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  if (!canManageCalendar) return { error: "Forbidden." }

  const table = CALENDAR_TABLES[calendarType].events

  const { data: existing } = await supabase
    .from(table)
    .select(
      "id,org_id,title,description,event_type,starts_at,ends_at,all_day,recurrence,status,assigned_roles,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .eq("id", eventId)
    .maybeSingle()

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("org_id", orgId)
    .eq("id", eventId)

  if (deleteError) return { error: deleteError.message }

  if (existing) {
    await notifyCalendarChange({
      orgId,
      actorId: user.id,
      calendarType,
      action: "deleted",
      event: mapCalendarRow(existing),
    })
  }

  return { ok: true }
}

export async function getRoadmapCalendarFeedTokens(): Promise<FeedTokenResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  if (!canManageCalendar) return { error: "Forbidden." }

  const [publicToken, internalToken] = await Promise.all([
    ensureFeedToken({ supabase, orgId, calendarType: "public" }),
    ensureFeedToken({ supabase, orgId, calendarType: "internal" }),
  ])

  if ("error" in publicToken) return { error: publicToken.error }
  if ("error" in internalToken) return { error: internalToken.error }

  return {
    ok: true,
    publicToken: publicToken.token,
    internalToken: internalToken.token,
  }
}

export async function rotateRoadmapCalendarFeedToken({
  calendarType,
}: {
  calendarType: RoadmapCalendarType
}): Promise<FeedRotateResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  const { orgId, canManageCalendar } = await resolveCalendarAccess(
    supabase,
    user.id
  )
  if (!canManageCalendar) return { error: "Forbidden." }

  const table = CALENDAR_TABLES[calendarType].feeds
  const token = createFeedToken()

  const { data, error: updateError } = await supabase
    .from(table)
    .upsert({ org_id: orgId, token, rotated_at: new Date().toISOString() })
    .select("token")
    .maybeSingle<{ token: string }>()

  if (updateError || !data) {
    return { error: updateError?.message ?? "Unable to rotate token." }
  }

  return { ok: true, token: data.token }
}
