import { describe, expect, it } from "vitest"
import {
  isMobileNavigationPathActive,
  resolveMobileNavigationIndex,
} from "@/features/mobile-navigation/lib"

const bar = { left: 12, top: 720, width: 360, height: 64, count: 5 }

describe("mobile navigation gestures", () => {
  it.each([
    [12, 0],
    [83, 0],
    [85, 1],
    [228, 3],
    [372, 4],
  ])("selects the released destination at x=%s", (x, expected) => {
    expect(resolveMobileNavigationIndex({ ...bar, x, y: 750 })).toBe(expected)
  })
  it.each([
    [11, 750],
    [373, 750],
    [100, 719],
    [100, 785],
  ])("cancels a release outside the bar (%s, %s)", (x, y) => {
    expect(resolveMobileNavigationIndex({ ...bar, x, y })).toBeNull()
  })
  it("ignores an unmeasured or empty bar", () => {
    expect(
      resolveMobileNavigationIndex({ ...bar, width: 0, x: 12, y: 750 })
    ).toBeNull()
    expect(
      resolveMobileNavigationIndex({ ...bar, count: 0, x: 12, y: 750 })
    ).toBeNull()
  })
  it("matches nested routes without selecting Find everywhere or matching route prefixes", () => {
    expect(
      isMobileNavigationPathActive("/workspace/roadmap", "/workspace")
    ).toBe(true)
    expect(isMobileNavigationPathActive("/workspace", "/")).toBe(false)
    expect(isMobileNavigationPathActive("/coaching-other", "/coaching")).toBe(
      false
    )
    expect(isMobileNavigationPathActive("/", "/")).toBe(true)
  })
})
