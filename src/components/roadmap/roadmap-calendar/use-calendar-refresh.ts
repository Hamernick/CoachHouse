"use client"

import { useEffect, useReducer } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { WORKSPACE_CALENDAR_CHANGED } from "@/lib/roadmap/calendar-events"
import { useSupabaseClient } from "@/hooks/use-supabase-client"

/** Subscription is separate from rendering so lifecycle, coalescing and account
 * changes can be checked without a browser or a second state store. */
export function subscribeWorkspaceCalendar(client: SupabaseClient<Database>, orgId: string, refresh: () => void) {
  let closed = false
  let live = false
  let actorId: string | null | undefined
  let channel: RealtimeChannel | null = null
  let generation = 0
  let enabled = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let reconnect: ReturnType<typeof setTimeout> | undefined
  const invalidate = () => {
    if (closed || !enabled || document.visibilityState === "hidden") return
    clearTimeout(timer)
    timer = setTimeout(() => { if (!closed && document.visibilityState !== "hidden") refresh() }, 80)
  }
  const changed = (event: Event) => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : null
    if (!live && detail && typeof detail === "object" && "orgId" in detail && detail.orgId === orgId) invalidate()
  }
  const focused = () => invalidate()
  // RLS authorizes delivery; only the tiny revision row is published. Dragging
  // does not emit calendar signals or transmit the workspace graph.
  const disconnect = () => {
    generation += 1
    live = false
    clearTimeout(timer)
    clearTimeout(reconnect)
    if (channel) void client.removeChannel(channel).catch(() => {})
    channel = null
  }
  const connect = () => {
    const epoch = ++generation
    channel = client.channel(`workspace-calendar:${orgId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_workspace_calendar_revisions", filter: `org_id=eq.${orgId}` }, () => { if (generation === epoch) invalidate() })
      .subscribe(status => {
        if (closed || generation !== epoch) return
        live = status === "SUBSCRIBED"
        if (live) invalidate() // initial read/subscription gap and reconnect
      })
  }
  connect()
  const auth = client.auth.onAuthStateChange((_event, session) => {
    if (closed) return
    const nextId = session?.user.id ?? null
    if (actorId === undefined && nextId !== null) { actorId = nextId; return }
    if (actorId === nextId) return
    actorId = nextId
    disconnect()
    enabled = nextId !== null
    // Rejoin after the SDK's synchronous auth callback releases its auth lock.
    if (enabled) reconnect = setTimeout(() => { if (!closed && enabled) connect() }, 0)
    refresh()
  })
  window.addEventListener(WORKSPACE_CALENDAR_CHANGED, changed)
  window.addEventListener("focus", focused)
  document.addEventListener("visibilitychange", focused)
  return () => {
    closed = true
    disconnect()
    auth.data.subscription.unsubscribe()
    window.removeEventListener(WORKSPACE_CALENDAR_CHANGED, changed)
    window.removeEventListener("focus", focused)
    document.removeEventListener("visibilitychange", focused)
  }
}

/** No polling interval, hidden-tab requests or per-keystroke work. */
export function useCalendarRefresh(orgId: string | null) {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const client = useSupabaseClient()
  useEffect(() => orgId ? subscribeWorkspaceCalendar(client, orgId, refresh) : undefined, [orgId, client])
  return revision
}
