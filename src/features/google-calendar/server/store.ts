import "server-only"
import { randomUUID } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase"
import type { Json } from "@/lib/supabase/schema/json"
import { CalendarError, type CalendarState } from "../types"
export type Connection =
  Database["public"]["Tables"]["google_calendar_connections"]["Row"]
export const emptyCalendarState = (): CalendarState => ({
  selected: [],
  caches: {},
  destinations: {},
})
export const stateOf = (row: Connection) =>
  row.state as unknown as CalendarState
export const asJson = (value: unknown) => value as Json
export function checked<T>(result: { data: T; error: unknown }) {
  if (result.error) throw new CalendarError("provider_unavailable", 503)
  return result.data
}
export async function getConnection(userId: string) {
  return checked(
    await createSupabaseAdminClient()
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
  )
}
export async function updateConnection(
  row: Connection,
  values: Database["public"]["Tables"]["google_calendar_connections"]["Update"],
  invalidate = false
) {
  const data = checked(
    await createSupabaseAdminClient()
      .from("google_calendar_connections")
      .update({
        ...values,
        updated_at: new Date().toISOString(),
        ...(invalidate
          ? { revision: randomUUID(), lease_id: null, lease_expires_at: null }
          : {}),
      })
      .eq("user_id", row.user_id)
      .eq("revision", row.revision)
      .select("*")
      .maybeSingle()
  )
  if (!data) throw new CalendarError("sync_busy", 409)
  return data
}
export async function requireActiveLease(row: Connection) {
  const current = await getConnection(row.user_id)
  if (
    !current?.enabled ||
    current.status !== "connected" ||
    current.revision !== row.revision ||
    current.lease_id !== row.lease_id ||
    Date.parse(current.lease_expires_at ?? "") <= Date.now()
  )
    throw new CalendarError("sync_paused", 409)
  return current
}
export async function canExportOrganization(userId: string, orgId: string) {
  const admin = createSupabaseAdminClient()
  const admit = admin.rpc.bind(admin) as unknown as (
    name: "authorize_organization_calendar_export",
    args: { p_actor_id: string; p_org_id: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await admit(
    "authorize_organization_calendar_export",
    { p_actor_id: userId, p_org_id: orgId },
  )
  // A missing migration, concurrent shutdown or revoked membership cannot
  // admit a provider request through the service client's RLS bypass.
  return !error && data === true
}
