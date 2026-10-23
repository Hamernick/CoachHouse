import "server-only"
import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { CalendarError } from "../types"
import { normalizeCalendarSettings } from "../lib"
import { calendarConfig, CALENDAR_LIST_SCOPE, CALENDAR_READ_SCOPE } from "./config"
import {
  calendarChoices,
  calendarSummary,
  disconnectCalendar,
  personalCalendarEvents,
  saveCalendarSettings,
  setCalendarEnabled,
} from "./service"
import { completeCalendarConnection, startCalendarConnection } from "./oauth"
import { checked } from "./store"
import { syncCalendar } from "./sync"

type Operation =
  | "connection"
  | "connect"
  | "calendars"
  | "settings"
  | "enabled"
  | "disconnect"
  | "events"
  | "sync"
function failure(error: unknown) {
  const normalized =
    error instanceof CalendarError
      ? error
      : new CalendarError("provider_unavailable", 503)
  logger.warn("google_calendar_result", {
    outcome: normalized.code,
    status: normalized.status,
  })
  return NextResponse.json(
    { code: normalized.code },
    { status: normalized.status, headers: { "cache-control": "no-store" } }
  )
}
async function context(request: NextRequest, response: NextResponse) {
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new CalendarError("unauthorized", 401)
  const org = await resolveActiveOrganization(supabase, user.id)
  if (org.supportAccess) throw new CalendarError("forbidden", 403)
  return { userId: user.id, orgId: org.orgId }
}
export function calendarHandler(operation: Operation) {
  return async (request: NextRequest) => {
    const cookies = new NextResponse()
    let response: NextResponse
    try {
      if (
        request.method !== "GET" &&
        request.headers.get("origin") !== request.nextUrl.origin
      )
        throw new CalendarError("forbidden", 403)
      const { userId, orgId } = await context(request, cookies)
      if (operation !== "connection" && operation !== "disconnect")
        calendarConfig()
      let result: unknown
      if (operation === "connection")
        result = await calendarSummary(userId, orgId)
      else if (operation === "connect")
        result = { url: await startCalendarConnection(userId) }
      else if (operation === "calendars")
        result = { calendars: await calendarChoices(userId) }
      else if (operation === "events") {
        const from = request.nextUrl.searchParams.get("from") ?? ""
        const to = request.nextUrl.searchParams.get("to") ?? ""
        const span = Date.parse(to) - Date.parse(from)
        if (!Number.isFinite(span) || span <= 0 || span > 45 * 86400000)
          throw new CalendarError("invalid")
        result = { events: await personalCalendarEvents(userId, from, to) }
      } else if (operation === "sync") result = await syncCalendar(userId)
      else {
        if (operation === "settings") {
          const input = await request.json()
          if (input?.expectedOrgId !== orgId)
            throw new CalendarError("workspace_changed", 409)
          await saveCalendarSettings(
            userId,
            orgId,
            normalizeCalendarSettings(input)
          )
        }
        if (operation === "enabled") {
          const body = await request.json()
          if (typeof body.enabled !== "boolean")
            throw new CalendarError("invalid")
          await setCalendarEnabled(userId, body.enabled)
        }
        if (operation === "disconnect") await disconnectCalendar(userId)
        result = await calendarSummary(userId, orgId)
      }
      response = NextResponse.json(result, {
        headers: { "cache-control": "no-store" },
      })
    } catch (error) {
      response = failure(error)
    }
    cookies.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }
}
export async function calendarCallback(request: NextRequest) {
  const cookies = new NextResponse()
  const destination = new URL("/workspace?drawer=tools", request.url)
  try {
    const { userId } = await context(request, cookies)
    if (request.nextUrl.searchParams.has("error"))
      throw new CalendarError("authorization_denied")
    const reportedScope = request.nextUrl.searchParams.get("scope")
    // This hint can reject an incomplete grant without consuming one-time state.
    // The token response still authoritatively validates permissions on success.
    if (
      reportedScope !== null &&
      ![CALENDAR_READ_SCOPE, CALENDAR_LIST_SCOPE].every((scope) =>
        reportedScope.split(/\s+/).includes(scope)
      )
    )
      throw new CalendarError("scope_denied")
    await completeCalendarConnection(
      userId,
      request.nextUrl.searchParams.get("state") ?? "",
      request.nextUrl.searchParams.get("code") ?? ""
    )
    destination.searchParams.set("googleCalendar", "setup")
  } catch (error) {
    const outcome =
      error instanceof CalendarError ? error.code : "provider_unavailable"
    logger.warn("google_calendar_callback", { outcome })
    destination.searchParams.set("googleCalendar", outcome)
  }
  const response = NextResponse.redirect(destination, {
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  })
  cookies.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return response
}
export async function calendarCron(request: NextRequest) {
  try {
    const actual = Buffer.from(request.headers.get("authorization") ?? "")
    if (
      ![env.GOOGLE_CALENDAR_CRON_SECRET, process.env.CRON_SECRET].some((secret) => {
        if (!secret || secret.length < 32) return false
        const expected = Buffer.from("Bearer " + secret)
        return actual.length === expected.length && timingSafeEqual(actual, expected)
      })
    )
      throw new CalendarError("unauthorized", 401)
    calendarConfig()
    const now = new Date().toISOString()
    const rows =
      checked(
        await createSupabaseAdminClient()
          .from("google_calendar_connections")
          .select("user_id")
          .eq("enabled", true)
          .eq("status", "connected")
          .lte("next_sync_at", now)
          .or("lease_expires_at.is.null,lease_expires_at.lt." + now)
          .order("next_sync_at")
          .limit(10)
      ) ?? []
    const stopAt = Date.now() + 45000
    let processed = 0
    for (const row of rows) {
      if (Date.now() >= stopAt - 5000) break
      try {
        await syncCalendar(row.user_id, stopAt)
      } catch (error) {
        logger.warn("google_calendar_sync", {
          outcome:
            error instanceof CalendarError
              ? error.code
              : "provider_unavailable",
        })
      }
      processed++
    }
    return NextResponse.json(
      { processed },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (error) {
    return failure(error)
  }
}
