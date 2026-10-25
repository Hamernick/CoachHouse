import { afterEach, describe, expect, it, vi } from "vitest"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { subscribeWorkspaceCalendar } from "@/components/roadmap/roadmap-calendar/use-calendar-refresh"
import { notifyWorkspaceCalendarChanged } from "@/lib/roadmap/calendar-events"
import { ID, WORKSPACE } from "./fixtures/particle-fixtures"

function fixture() {
  vi.useFakeTimers()
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("window", win)
  vi.stubGlobal("document", doc)
  let signal = () => {}, status = (_value: string) => {}
  let authChanged = (_event: AuthChangeEvent, _session: Session | null) => {}
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, callback: () => void) => { signal = callback; return channel }),
    subscribe: vi.fn((callback: (value: string) => void) => { status = callback; return channel }),
  }
  const unsubscribe = vi.fn()
  const client = {
    channel: vi.fn(() => channel), removeChannel: vi.fn(async () => "ok"),
    auth: { onAuthStateChange: vi.fn((callback: typeof authChanged) => { authChanged = callback; return { data: { subscription: { unsubscribe } } } }) },
  }
  const refresh = vi.fn()
  const stop = subscribeWorkspaceCalendar(client as never, WORKSPACE, refresh)
  const session = (id: string): Session => ({ access_token: "test", refresh_token: "test", expires_in: 3600,
    token_type: "bearer", user: { id, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-10-14T00:00:00Z" } })
  return { win, doc, client, channel, refresh, stop, unsubscribe,
    signal: () => signal(), status: (value: string) => status(value),
    auth: (id: string | null) => authChanged("SIGNED_IN", id ? session(id) : null),
    settle: () => vi.advanceTimersByTime(80) }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("bounded authenticated calendar invalidation", () => {
  it("subscribes only to the organization signal and catches initial/reconnection changes", () => {
    const f = fixture()
    expect(f.channel.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "organization_workspace_calendar_revisions", filter: `org_id=eq.${WORKSPACE}`,
    }, expect.any(Function))
    f.status("SUBSCRIBED"); f.settle()
    expect(f.refresh).toHaveBeenCalledOnce()
    f.signal(); f.signal(); f.signal(); f.settle()
    expect(f.refresh).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60000)
    expect(f.refresh).toHaveBeenCalledTimes(2)
    f.status("CHANNEL_ERROR"); f.status("SUBSCRIBED"); f.settle()
    expect(f.refresh).toHaveBeenCalledTimes(3)
    f.stop()
  })
  it("avoids duplicate local refreshes while live, but uses scoped fallback notifications offline", () => {
    const f = fixture()
    f.status("SUBSCRIBED"); f.settle(); f.refresh.mockClear()
    notifyWorkspaceCalendarChanged(WORKSPACE); f.settle()
    expect(f.refresh).not.toHaveBeenCalled()
    f.status("CHANNEL_ERROR")
    notifyWorkspaceCalendarChanged(ID(777)); f.settle()
    expect(f.refresh).not.toHaveBeenCalled()
    notifyWorkspaceCalendarChanged(WORKSPACE); f.settle()
    expect(f.refresh).toHaveBeenCalledOnce()
    f.stop()
  })
  it("does no hidden-tab work and refreshes once when returning to the visible page", () => {
    const f = fixture()
    f.doc.visibilityState = "hidden"
    f.status("SUBSCRIBED"); f.signal(); f.win.dispatchEvent(new Event("focus")); f.settle()
    expect(f.refresh).not.toHaveBeenCalled()
    f.doc.visibilityState = "visible"
    f.doc.dispatchEvent(new Event("visibilitychange")); f.win.dispatchEvent(new Event("focus")); f.settle()
    expect(f.refresh).toHaveBeenCalledOnce()
    f.stop()
  })
  it("reconnects across sign-out/sign-in to the same organization without hidden polling", () => {
    const f = fixture()
    f.auth(ID(1)); f.status("SUBSCRIBED"); f.settle(); f.refresh.mockClear()
    f.auth(null)
    expect(f.refresh).toHaveBeenCalledOnce()
    f.signal(); f.win.dispatchEvent(new Event("focus")); f.settle()
    expect(f.refresh).toHaveBeenCalledOnce()
    f.auth(ID(1)); f.status("SUBSCRIBED"); f.settle()
    expect(f.client.channel).toHaveBeenCalledTimes(2)
    f.refresh.mockClear(); f.signal(); f.settle()
    expect(f.refresh).toHaveBeenCalledOnce()
    f.stop()
  })

  it("cancels pending work, listeners and channel on cleanup or account changes", () => {
    const f = fixture()
    f.signal(); f.stop(); f.signal(); f.win.dispatchEvent(new Event("focus")); f.settle()
    expect(f.refresh).not.toHaveBeenCalled()
    expect(f.unsubscribe).toHaveBeenCalledOnce()
    expect(f.client.removeChannel).toHaveBeenCalledOnce()
    const g = fixture()
    g.auth(ID(1)); g.auth(ID(2)); g.settle()
    expect(g.client.removeChannel).toHaveBeenCalledOnce()
    expect(g.refresh).toHaveBeenCalledOnce()
    expect(g.client.channel).toHaveBeenCalledTimes(2)
    g.status("SUBSCRIBED"); g.settle(); g.signal(); g.settle()
    expect(g.refresh).toHaveBeenCalledTimes(3)
    g.stop()
    expect(g.client.removeChannel).toHaveBeenCalledTimes(2)
  })
})
