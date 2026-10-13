import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/features/build-collect-navigation/components/public-home-landing-header", () => ({ PublicHomeLandingHeader: () => null }))
vi.mock("@/components/public/public-map-index/footer", () => ({ PublicMapFooter: () => null }))

import { BuildPublicLanding } from "@/features/build-collect-navigation/components/build-public-landing"
import { BUILD_NAVIGATION_ITEMS } from "@/features/build-collect-navigation/lib"

describe("public Workspace landing", () => {
  it("renders every menu destination without authentication or async data", () => {
    const markup = renderToStaticMarkup(React.createElement(BuildPublicLanding))
    expect(markup).toContain("Workspace for nonprofits.")
    for (const item of BUILD_NAVIGATION_ITEMS) {
      expect(markup).toContain(`id="${item.href.split("#")[1]}"`)
    }
    expect(markup).toContain('href="/documentation"')
    expect(markup).toContain('href="/documentation/fiscal-sponsorship#application"')
    expect(markup).not.toContain("/home-canvas")
  })

  it("keeps the chosen plan in the signup URL and pricing after documentation", () => {
    const markup = renderToStaticMarkup(React.createElement(BuildPublicLanding))
    for (const plan of ["free", "organization", "operations_support"]) {
      expect(markup).toContain(`href="/sign-up?intent=build&amp;plan=${plan}"`)
    }
    expect(markup.indexOf('id="pricing"')).toBeGreaterThan(markup.indexOf('id="documentation"'))
    expect(markup).toContain("Fiscal sponsorship applications are open without an account or paid plan.")
  })
})
