import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PricingCallToActionSection } from "@/components/public/pricing-surface-sections/pricing-call-to-action-section"
import { PricingFeatureBreakdownIntroSection } from "@/components/public/pricing-surface-sections/pricing-feature-breakdown-intro-section"

import { PricingTierCardsSection } from "@/components/public/pricing-surface-sections/pricing-tier-cards-section"

describe("public pricing sign up links", () => {
  it("preserves the selected plan through direct signup links", () => {
    const markup = renderToStaticMarkup(React.createElement(PricingTierCardsSection))
    for (const plan of ["free", "organization", "operations_support"]) {
      expect(markup).toContain(`href="/sign-up?intent=build&amp;plan=${plan}"`)
    }
    expect(markup).not.toContain("/home-canvas")
  })

  it("routes pricing get-started buttons through the canonical signup page", () => {
    const callToActionMarkup = renderToStaticMarkup(
      React.createElement(PricingCallToActionSection),
    )
    const featureIntroMarkup = renderToStaticMarkup(
      React.createElement(PricingFeatureBreakdownIntroSection),
    )

    expect(callToActionMarkup).toContain('href="/sign-up?intent=build"')
    expect(featureIntroMarkup).toContain('href="/sign-up?intent=build"')
    expect(callToActionMarkup).not.toContain("plan=individual")
    expect(featureIntroMarkup).not.toContain("plan=individual")
  })
})
