import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { startBackgroundPolling } from "@/lib/background-polling"
import { documentPollingInterval, documentPresenceInterval } from "@/features/organization-document-collaboration/lib/polling"

let page: EventTarget & { visibilityState: string }
const stops: Array<() => void> = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, "random").mockReturnValue(0)
  page = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("document", page)
  vi.stubGlobal("window", new EventTarget())
})
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("bounded collaboration polling", () => {
  it("bounds a solo document to 22 steady-state requests per minute across all three channels", async () => {
    const workspace = vi.fn(async () => true), document = vi.fn(async () => true), presence = vi.fn(async () => true)
    stops.push(startBackgroundPolling({ run: workspace, intervalMs: () => 5000 }))
    stops.push(startBackgroundPolling({ run: document, intervalMs: () => documentPollingInterval(false, false), immediate: false }))
    stops.push(startBackgroundPolling({ run: presence, intervalMs: () => documentPresenceInterval(false) }))
    await vi.advanceTimersByTimeAsync(15 * 60_000)
    // Two initial presence requests + 330 periodic requests over 15 minutes.
    expect(workspace).toHaveBeenCalledTimes(181)
    expect(document).toHaveBeenCalledTimes(60)
    expect(presence).toHaveBeenCalledTimes(91)
  })

  it("retains two-second refreshes for unsaved edits and active collaborators", () => {
    expect(documentPollingInterval(true, false)).toBe(2000)
    expect(documentPollingInterval(false, true)).toBe(2000)
    expect(documentPresenceInterval(true)).toBe(5000)
  })

  it("never overlaps a slow request, even on focus or reconnect", async () => {
    let finish!: () => void
    const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    stops.push(startBackgroundPolling({ run, intervalMs: () => 5000 }))
    await vi.advanceTimersByTimeAsync(60_000)
    page.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online"))
    expect(run).toHaveBeenCalledOnce()
    finish()
    await vi.advanceTimersByTimeAsync(4999)
    expect(run).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("pauses decorative reads while hidden and resumes on visibility", async () => {
    const run = vi.fn(async () => true)
    stops.push(startBackgroundPolling({ run, intervalMs: () => 5000 }))
    await vi.advanceTimersByTimeAsync(0)
    page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledOnce()
    page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("retains the authorization heartbeat for hidden support sessions", async () => {
    page.visibilityState = "hidden"
    const run = vi.fn(async () => true)
    stops.push(startBackgroundPolling({ run, intervalMs: () => 5000, enabled: () => true }))
    await vi.advanceTimersByTimeAsync(15_000)
    expect(run).toHaveBeenCalledTimes(4)
  })

  it("resumes pending durable work created while hidden without needing a focus event", async () => {
    page.visibilityState = "hidden"
    let pending = false
    const run = vi.fn(async () => true)
    stops.push(startBackgroundPolling({ run, intervalMs: () => 5000, enabled: () => pending }))
    await vi.advanceTimersByTimeAsync(15_000)
    expect(run).not.toHaveBeenCalled()
    pending = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).toHaveBeenCalledOnce()
  })

  it("backs off failures to 30 seconds, survives focus without retry storms, then recovers", async () => {
    const run = vi.fn(async () => false)
    stops.push(startBackgroundPolling({ run, intervalMs: () => 5000 }))
    await vi.advanceTimersByTimeAsync(0)
    page.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(9999)
    expect(run).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(run).toHaveBeenCalledTimes(3)
    run.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(run).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(5000)
    expect(run).toHaveBeenCalledTimes(5)
  })

  it("cannot restart after cleanup when an in-flight request settles", async () => {
    let finish!: () => void
    const run = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const stop = startBackgroundPolling({ run, intervalMs: () => 5000 })
    stop(); finish()
    await vi.advanceTimersByTimeAsync(60_000)
    page.dispatchEvent(new Event("visibilitychange"))
    expect(run).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
