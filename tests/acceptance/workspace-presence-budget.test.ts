import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ request: vi.fn(), cleanups: [] as Array<() => void> }))
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => (() => void) | undefined) => { const stop = effect(); if (stop) mocks.cleanups.push(stop) },
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace" }))
vi.mock("@/lib/feature-flags", () => ({ organizationWorkspaceSupportEnabled: true }))
vi.mock("@/features/organization-workspace-support/lib/presence-transport", () => ({ workspacePresenceOverHttp: mocks.request }))
import { useOrganizationWorkspaceSupportController } from "@/features/organization-workspace-support/hooks/use-organization-workspace-support-controller"

let page: EventTarget & { visibilityState: string }
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0)
  page = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("document", page); vi.stubGlobal("window", new EventTarget())
  mocks.request.mockReset().mockResolvedValue({ participants: [] })
})
afterEach(() => {
  mocks.cleanups.splice(0).forEach(stop => stop())
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})
describe("actual workspace controller request budget", () => {
  it("sends at most 181 heartbeat requests in 15 minutes, including its initial request", async () => {
    useOrganizationWorkspaceSupportController("target-org", true)
    await vi.advanceTimersByTimeAsync(900_000)
    expect(mocks.request).toHaveBeenCalledTimes(181)
    expect(mocks.request.mock.calls[0][0]).toMatchObject({ organizationId: "target-org", path: "/workspace" })
    const session = mocks.request.mock.calls[0][0].sessionId
    mocks.cleanups.splice(0).forEach(stop => stop())
    expect(mocks.request.mock.lastCall?.[0]).toMatchObject({ sessionId: session, leave: true })
    expect(vi.getTimerCount()).toBe(0)
  })
  it("pauses hidden ordinary-member roster reads but retains support authorization heartbeats", async () => {
    page.visibilityState = "hidden"
    useOrganizationWorkspaceSupportController("target-org", false)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.request).not.toHaveBeenCalled()
    mocks.cleanups.splice(0).forEach(stop => stop()); mocks.request.mockClear()
    useOrganizationWorkspaceSupportController("target-org", true)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(mocks.request).toHaveBeenCalledTimes(4)
  })
  it("bounds an unavailable service to the backoff budget instead of retrying every second", async () => {
    mocks.request.mockResolvedValue({ error: "unavailable" })
    useOrganizationWorkspaceSupportController("target-org", true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.request).toHaveBeenCalledTimes(4)
  })
  it("stops an unavailable target until a new organization scope mounts", async () => {
    mocks.request.mockResolvedValue({ error: "Unavailable", code: "organization_unavailable", retryable: false })
    useOrganizationWorkspaceSupportController("missing-org", true)
    await vi.advanceTimersByTimeAsync(60_000)
    page.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online"))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.request).toHaveBeenCalledOnce()
    mocks.cleanups.splice(0).forEach(stop => stop())
    mocks.request.mockReset().mockResolvedValue({ participants: [] })
    useOrganizationWorkspaceSupportController("existing-org", true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(mocks.request.mock.calls[0][0].organizationId).toBe("existing-org")
  })

})
