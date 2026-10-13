import { describe, expect, it } from "vitest"

import { resolveMapCompactState } from "@/components/public/public-map-index/use-collapsing-map"

const position = (scrollTop: number, overflow = 400) => ({
  scrollTop,
  clientHeight: 500,
  scrollHeight: 500 + overflow,
})

describe("resource map collapse across page and result scrolling", () => {
  it("collapses when scrolling beside a stationary results feed", () => {
    expect(resolveMapCompactState(false, position(154), position(0))).toBe(true)
  })

  it("collapses when scrolling the results while the page stays at the top", () => {
    expect(resolveMapCompactState(false, position(0), position(80))).toBe(true)
  })

  it("stays compact until both scroll areas reach the top", () => {
    expect(resolveMapCompactState(true, position(80), position(0))).toBe(true)
    expect(resolveMapCompactState(true, position(0), position(80))).toBe(true)
    expect(resolveMapCompactState(true, position(0), position(0))).toBe(false)
  })

  it("preserves discovery scrolling without a result feed", () => {
    expect(resolveMapCompactState(false, position(80))).toBe(true)
    expect(resolveMapCompactState(true, position(0))).toBe(false)
  })

  it("avoids oscillating when the expanded feed consumes its scroll range", () => {
    expect(resolveMapCompactState(true, position(0), position(0, 0))).toBe(true)
    expect(resolveMapCompactState(false, position(0), position(0, 0))).toBe(false)
  })
})
