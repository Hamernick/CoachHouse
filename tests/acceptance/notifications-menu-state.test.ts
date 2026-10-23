import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppNotification } from "@/app/actions/notifications"

// Run the real hook callbacks/effects with persistent slots, as in the document
// controller tests. These regressions concern request ordering, not rendering.
const hooks = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as unknown[],
  effects: [] as Array<() => void>,
  cleanups: new Map<number, () => void>(),
}))
vi.mock("react", () => {
  const memo = <T,>(value: T, deps: unknown[]) => {
    const index = hooks.cursor++
    const previous = hooks.slots[index] as { value: T; deps: unknown[] } | undefined
    const changed = !previous || deps.length !== previous.deps.length || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
    if (changed) hooks.slots[index] = { value, deps }
    return { index, changed, value: changed ? value : previous!.value }
  }
  return {
    useRef: <T,>(current: T) => { const index = hooks.cursor++; return hooks.slots[index] ??= { current } },
    useState: <T,>(initial: T | (() => T)) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => T)() : initial
      return [hooks.slots[index], (next: T | ((value: T) => T)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (value: T) => T)(hooks.slots[index] as T) : next
      }]
    },
    useMemo: <T,>(factory: () => T, deps: unknown[]) => {
      const index = hooks.cursor
      const previous = hooks.slots[index] as { value: T; deps: unknown[] } | undefined
      const changed = !previous || deps.length !== previous.deps.length || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
      return memo(changed ? factory() : previous!.value, deps).value
    },
    useCallback: <T,>(callback: T, deps: unknown[]) => memo(callback, deps).value,
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const { index, changed } = memo(effect, deps)
      if (changed) hooks.effects.push(() => {
        hooks.cleanups.get(index)?.()
        hooks.cleanups.delete(index)
        const stop = effect()
        if (stop) hooks.cleanups.set(index, stop)
      })
    },
  }
})
const actions = vi.hoisted(() => ({
  list: vi.fn(), read: vi.fn(), unread: vi.fn(), all: vi.fn(),
  accept: vi.fn(), decline: vi.fn(), push: vi.fn(),
  error: vi.fn(), success: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }))
vi.mock("@/app/actions/notifications", () => ({
  listNotificationsAction: actions.list,
  markNotificationReadAction: actions.read,
  markNotificationUnreadAction: actions.unread,
  markAllNotificationsReadAction: actions.all,
}))
vi.mock("@/app/actions/organization-access", () => ({
  acceptOrganizationAccessRequestAction: actions.accept,
  declineOrganizationAccessRequestAction: actions.decline,
}))
vi.mock("@/features/organization-access", () => ({ readOrganizationAccessRequestNotificationMetadata: () => null }))
vi.mock("@/lib/toast", () => ({ toast: { error: actions.error, success: actions.success } }))

import { useNotificationsMenuState } from "@/components/notifications/hooks/use-notifications-menu-state"
import { WORKSPACE_MUTATION_EVENT } from "@/lib/with-save-feedback"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const notification = (id = "one", readAt: string | null = null): AppNotification => ({
  id, title: id, description: "Notification", href: "/workspace", tone: "info",
  createdAt: "2026-10-16T12:00:00Z", readAt, archivedAt: null, type: null, metadata: null,
})
const response = (totalCount = 134, unreadCount = 61, inbox = [notification()]) => ({ ok: true as const, inbox, totalCount, unreadCount })
async function settle() { for (let i = 0; i < 12; i += 1) await Promise.resolve() }
function TestNotificationsMenu() {
  return useNotificationsMenuState()
}
function render() {
  hooks.cursor = 0
  const state = TestNotificationsMenu()
  hooks.effects.splice(0).forEach(effect => effect())
  return state
}
async function mount() {
  render()
  render()
  await settle()
  render()
  return render()
}
let page: EventTarget & { visibilityState: string }

beforeEach(() => {
  vi.useFakeTimers()
  hooks.cursor = 0; hooks.slots = []; hooks.effects = []; hooks.cleanups.clear()
  Object.values(actions).forEach(mock => mock.mockReset())
  actions.list.mockResolvedValue(response())
  actions.read.mockResolvedValue({ ok: true })
  actions.unread.mockResolvedValue({ ok: true })
  actions.all.mockResolvedValue({ ok: true })
  page = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("document", page)
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }))
})
afterEach(() => {
  hooks.cleanups.forEach(stop => stop())
  hooks.cleanups.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("notification menu server counts and request ordering", () => {
  it.each(["session-error", "network-error"])("clears private preview and counts after %s", async outcome => {
    const state = await mount()
    state.handleSelect(state.inboxItems[0])
    if (outcome === "session-error") actions.list.mockResolvedValue({ error: "Not authenticated." })
    else actions.list.mockRejectedValue(new Error("Offline"))
    await state.refreshNotifications()
    expect(render()).toMatchObject({ inboxItems: [], selectedItem: null, totalCount: null, unreadCount: 0 })
  })

  it("discards an old account's in-flight load when its menu unmounts", async () => {
    const state = await mount()
    const stale = deferred<ReturnType<typeof response>>()
    actions.list.mockReturnValueOnce(stale.promise)
    const request = state.refreshNotifications()
    hooks.cleanups.forEach(stop => stop())
    stale.resolve(response(999, 999, [notification("old-account")]))
    await request
    expect(render().inboxItems.map(item => item.id)).not.toContain("old-account")
  })
  it("shows authoritative totals beyond the loaded page and no fabricated initial total", async () => {
    expect(render().totalCount).toBeNull()
    render(); await settle()
    const state = render()
    expect(state.inboxItems).toHaveLength(1)
    expect(state.totalCount).toBe(134)
    expect(state.unreadCount).toBe(61)
    expect(state.showBellUnreadCue).toBe(true)
  })

  it("keeps the newest refresh when responses arrive out of order", async () => {
    const state = await mount()
    const older = deferred<ReturnType<typeof response>>()
    const newer = deferred<ReturnType<typeof response>>()
    actions.list.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const first = state.refreshNotifications()
    const second = state.refreshNotifications()
    newer.resolve(response(140, 65)); await second
    older.resolve(response(135, 62)); await first
    expect(render()).toMatchObject({ totalCount: 140, unreadCount: 65, loading: false })
  })

  it("ignores a pre-mutation refresh and skips refreshes until the write settles", async () => {
    const state = await mount()
    const stale = deferred<ReturnType<typeof response>>()
    const mutation = deferred<{ ok: true }>()
    actions.list.mockReturnValueOnce(stale.promise).mockResolvedValue(response(134, 60, [notification("one", "2026-10-16T12:01:00Z")]))
    actions.read.mockReturnValueOnce(mutation.promise)
    const oldRefresh = state.refreshNotifications()
    state.handleToggleRead(state.inboxItems[0])
    expect(render().unreadCount).toBe(60)
    const calls = actions.list.mock.calls.length
    await render().refreshNotifications()
    expect(actions.list).toHaveBeenCalledTimes(calls)
    stale.resolve(response(134, 61)); await oldRefresh
    expect(render().unreadCount).toBe(60)
    mutation.resolve({ ok: true }); await settle()
    expect(actions.list).toHaveBeenCalledTimes(calls + 1)
    expect(render()).toMatchObject({ unreadCount: 60, selectedUpdating: false })
  })

  it.each(["success", "error", "throw"] as const)("reconciles individual unread counts after mutation %s", async outcome => {
    const state = await mount()
    const mutation = deferred<{ ok: true } | { error: string }>()
    actions.read.mockReturnValueOnce(mutation.promise)
    actions.list.mockResolvedValue(response(135, outcome === "success" ? 60 : 61))
    state.handleToggleRead(state.inboxItems[0])
    expect(render().unreadCount).toBe(60)
    if (outcome === "throw") mutation.reject(new Error("Offline"))
    else mutation.resolve(outcome === "success" ? { ok: true } : { error: "Write failed" })
    await settle()
    expect(render()).toMatchObject({ totalCount: 135, unreadCount: outcome === "success" ? 60 : 61, selectedUpdating: false })
    expect(actions.error).toHaveBeenCalledTimes(outcome === "success" ? 0 : 1)
  })

  it.each(["success", "error", "throw"] as const)("marks the whole inbox read and reconciles after bulk mutation %s", async outcome => {
    const state = await mount()
    const mutation = deferred<{ ok: true } | { error: string }>()
    actions.all.mockReturnValueOnce(mutation.promise)
    actions.list.mockResolvedValue(response(134, outcome === "success" ? 0 : 61))
    state.handleMarkAllRead()
    expect(actions.all.mock.calls[0]).toEqual([])
    expect(render()).toMatchObject({ unreadCount: 0, bulkUpdating: true })
    if (outcome === "throw") mutation.reject(new Error("Offline"))
    else mutation.resolve(outcome === "success" ? { ok: true } : { error: "Write failed" })
    await settle()
    expect(render()).toMatchObject({ unreadCount: outcome === "success" ? 0 : 61, bulkUpdating: false })
    expect(actions.error).toHaveBeenCalledTimes(outcome === "success" ? 0 : 1)
  })

  it("requests older unread rows from the server and ignores the previous tab response", async () => {
    const state = await mount()
    const staleAll = deferred<ReturnType<typeof response>>()
    actions.list.mockReturnValueOnce(staleAll.promise).mockResolvedValue(response(134, 61, [notification("older-unread")]))
    const oldRefresh = state.refreshNotifications()
    state.setTab("unread")
    render(); await settle()
    expect(actions.list).toHaveBeenLastCalledWith("unread")
    expect(render().filteredItems.map(item => item.id)).toEqual(["older-unread"])
    staleAll.resolve(response(134, 61, [notification("latest-read", "2026-10-16T12:01:00Z")]))
    await oldRefresh
    expect(render().filteredItems.map(item => item.id)).toEqual(["older-unread"])
  })

  it("reconciles using the current tab when a mutation started on another tab", async () => {
    const state = await mount()
    const mutation = deferred<{ ok: true }>()
    actions.read.mockReturnValueOnce(mutation.promise)
    state.handleToggleRead(state.inboxItems[0])
    state.setTab("unread")
    render()
    actions.list.mockImplementation(async tab => tab === "unread"
      ? response(134, 60, [notification("older-unread")])
      : response(134, 60, [notification("latest-read", "2026-10-16T12:01:00Z")]))
    mutation.resolve({ ok: true }); await settle()
    expect(actions.list).toHaveBeenLastCalledWith("unread")
    expect(render().filteredItems.map(item => item.id)).toEqual(["older-unread"])
  })

  it("refreshes on focus, visible 30-second intervals, and workspace saves", async () => {
    await mount()
    actions.list.mockClear()
    window.dispatchEvent(new Event("focus")); await settle()
    expect(actions.list).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(actions.list).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event(WORKSPACE_MUTATION_EVENT)); await settle()
    expect(actions.list).toHaveBeenCalledTimes(3)
    page.visibilityState = "hidden"
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(actions.list).toHaveBeenCalledTimes(3)
    page.visibilityState = "visible"
    page.dispatchEvent(new Event("visibilitychange")); await settle()
    expect(actions.list).toHaveBeenCalledTimes(4)
  })
})
