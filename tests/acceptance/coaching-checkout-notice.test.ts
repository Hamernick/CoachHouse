import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("react", () => ({ useEffect: (effect: () => void) => effect() }))
import { useCoachingCheckoutNotice } from "@/features/coaching-booking/hooks/use-coaching-checkout-notice"

const notice = "That time is no longer available. Choose another time."
function installBrowser(href: string) {
  const state = { retained: "navigation state" }
  const history = { state, replaceState: vi.fn() }
  vi.stubGlobal("window", { location: { href }, history })
  return history
}
afterEach(() => vi.unstubAllGlobals())

describe("coaching checkout notice recovery", () => {
  it("displays the notice for this visit and removes only its URL parameter", () => {
    const history = installBrowser("https://example.test/coaching?checkout=unavailable&booking=booking-1#times")
    expect(useCoachingCheckoutNotice(notice, false)).toBe(notice)
    expect(history.replaceState).toHaveBeenCalledWith(history.state, "", "/coaching?booking=booking-1#times")
  })

  it("clears the notice after a replacement booking succeeds", () => {
    installBrowser("https://example.test/coaching")
    expect(useCoachingCheckoutNotice(notice, true)).toBeUndefined()
  })

  it("preserves unrelated checkout state", () => {
    const history = installBrowser("https://example.test/coaching?checkout=success&booking=booking-1")
    expect(useCoachingCheckoutNotice(notice, false)).toBe(notice)
    expect(history.replaceState).not.toHaveBeenCalled()
  })

  it("does not alter URLs without a displayed notice", () => {
    const history = installBrowser("https://example.test/coaching?checkout=unavailable")
    expect(useCoachingCheckoutNotice(undefined, false)).toBeUndefined()
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})
