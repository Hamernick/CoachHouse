import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Exercise the real component effects with persistent hook slots and deferred
// requests. Surface presentation is separate; these cases prove actor ordering.
const hooks = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as unknown[],
  effects: [] as Array<() => void>,
  cleanups: new Map<number, () => void>(),
}))
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    useState: <T,>(initial: T) => {
      const index = hooks.cursor++
      if (!(index in hooks.slots)) hooks.slots[index] = initial
      return [hooks.slots[index], (next: T | ((value: T) => T)) => {
        hooks.slots[index] = typeof next === "function" ? (next as (value: T) => T)(hooks.slots[index] as T) : next
      }]
    },
    useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
      const index = hooks.cursor++
      const previous = hooks.slots[index] as unknown[] | undefined
      if (previous && deps.length === previous.length && deps.every((dep, i) => Object.is(dep, previous[i]))) return
      hooks.slots[index] = deps
      hooks.effects.push(() => {
        hooks.cleanups.get(index)?.()
        hooks.cleanups.delete(index)
        const cleanup = effect()
        if (cleanup) hooks.cleanups.set(index, cleanup)
      })
    },
  }
})
const actions = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock("@/features/fiscal-sponsorship/actions", () => ({ loadFiscalOrganizationApplications: actions.load }))
vi.mock("@/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface", () => ({ FiscalSponsorshipWorkspaceCardSurface: () => null }))
vi.mock("@/components/ui/button", () => ({ Button: () => null }))

import { FiscalLinkedWorkspaceCard } from "@/features/fiscal-sponsorship/components/fiscal-linked-workspace-card"
import { FiscalSponsorshipWorkspaceCardSurface } from "@/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-surface"
import { guestFollowupHref } from "@/features/fiscal-sponsorship/lib/guest-followup"

type Result = { applications: Array<{ reference: string; projectName: string; status: string; submittedAt: string }>; error?: string }
type Surface = React.ReactElement<React.ComponentProps<typeof FiscalSponsorshipWorkspaceCardSurface>>
const originalCard = React.createElement("button", { type: "button" }, "Start a fiscal application")
const application = (name: string, status = "submitted") => ({ reference: `${name}-reference`, projectName: name, status, submittedAt: "2026-10-20T00:00:00Z" })
function deferred() {
  let resolve!: (value: Result) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Result>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function render(organizationId: string) {
  hooks.cursor = 0
  const output = FiscalLinkedWorkspaceCard({ organizationId, children: originalCard })
  hooks.effects.splice(0).forEach((effect) => effect())
  return output
}
async function settle() { for (let i = 0; i < 8; i += 1) await Promise.resolve() }
function expectBlocked(output: React.ReactNode, status: string) {
  expect(output).not.toBe(originalCard)
  const surface = output as Surface
  expect(surface.type).toBe(FiscalSponsorshipWorkspaceCardSurface)
  expect(surface.props.applicationSummary?.status).toBe(status)
  expect(surface.props.openFlowHref).toBeUndefined()
  expect(surface.props.onStart).toBeUndefined()
}
beforeEach(() => {
  hooks.cursor = 0; hooks.slots = []; hooks.effects = []; hooks.cleanups.clear()
  actions.load.mockReset()
})
afterEach(() => { hooks.cleanups.forEach((cleanup) => cleanup()) })

describe("fiscal workspace card organization isolation", () => {
  it("hides the start card while loading and restores it only after a successful empty response", async () => {
    const request = deferred(); actions.load.mockReturnValue(request.promise)
    expectBlocked(render("org-a"), "Loading application…")
    expect(actions.load).toHaveBeenCalledWith("org-a")
    request.resolve({ applications: [] }); await settle()
    expect(render("org-a")).toBe(originalCard)
    expect(actions.load).toHaveBeenCalledOnce()
  })

  it("immediately hides the prior organization's application during a switch", async () => {
    const a = deferred(); const b = deferred()
    actions.load.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    render("org-a"); a.resolve({ applications: [application("A")] }); await settle()
    expect((render("org-a") as Surface).props.applicationSummary?.name).toBe("A")
    expectBlocked(render("org-b"), "Loading application…")
    b.resolve({ applications: [application("B", "needs_info")] }); await settle()
    const output = render("org-b") as Surface
    expect(output.props.applicationSummary).toEqual({ name: "B", status: "Needs info" })
    expect(output.props.openFlowHref).toBe(guestFollowupHref("B-reference"))
    expect(output.props.primaryActionLabel).toBe("Update application")
    expect(output.props.onStart).toBeUndefined()
  })

  it("ignores a late A response after B has loaded", async () => {
    const a = deferred(); const b = deferred()
    actions.load.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    render("org-a"); render("org-b")
    b.resolve({ applications: [application("B")] }); await settle()
    a.resolve({ applications: [application("A")] }); await settle()
    const output = render("org-b") as Surface
    expect(output.props.applicationSummary).toEqual({ name: "B", status: "Submitted" })
    expect(output.props.openFlowHref).toBe(guestFollowupHref("B-reference"))
    expect(output.props.primaryActionLabel).toBe("View application")
  })

  it.each(["returned", "rejected"])("keeps A and start hidden when B fails (%s), then retries only B", async (failure) => {
    const a = deferred(); const b = deferred(); const retry = deferred()
    actions.load.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(retry.promise)
    render("org-a"); a.resolve({ applications: [application("A")] }); await settle()
    expect((render("org-a") as Surface).props.applicationSummary?.name).toBe("A")
    expectBlocked(render("org-b"), "Loading application…")
    if (failure === "returned") b.resolve({ applications: [], error: "Unavailable" })
    else b.reject(new Error("Network failed"))
    await settle()
    const output = render("org-b") as Surface
    expectBlocked(output, failure === "returned" ? "Unavailable" : "Unable to load the application.")
    const retryButton = output.props.applicationLinks as React.ReactElement<{ onClick: () => void }>
    retryButton.props.onClick()
    expectBlocked(render("org-b"), "Loading application…")
    expect(actions.load.mock.calls.map(([org]) => org)).toEqual(["org-a", "org-b", "org-b"])
    retry.resolve({ applications: [] }); await settle()
    expect(render("org-b")).toBe(originalCard)
  })
})
