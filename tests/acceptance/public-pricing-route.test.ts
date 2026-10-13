import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/public/pricing-surface", () => ({
  PricingSurface: () => createElement("div", null, "Pricing"),
}))

import PricingPage, { metadata } from "@/app/(public)/pricing/page"
import { PricingSurface } from "@/components/public/pricing-surface"

describe("public pricing route", () => {
  it("renders pricing directly without waiting for auth or redirecting into the canvas", () => {
    expect(PricingPage().type).toBe(PricingSurface)
    expect(metadata.alternates?.canonical).toBe("/pricing")
  })
})
