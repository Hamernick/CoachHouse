import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth/login-panel", () => ({
  LoginPanel: (props: { redirectTo?: string }) =>
    createElement(
      "div",
      { "data-login-redirect-to": props.redirectTo },
      "Login panel"
    ),
}))

vi.mock("@/components/auth/sign-up-form", () => ({
  SignUpForm: (props: {
    builderRedirectTo?: string
    memberRedirectTo?: string
    defaultIntentFocus?: string
    lockedIntentFocus?: string | null
  }) =>
    createElement(
      "form",
      {
        "data-builder-redirect-to": props.builderRedirectTo,
        "data-member-redirect-to": props.memberRedirectTo,
        "data-default-intent-focus": props.defaultIntentFocus,
        "data-locked-intent-focus": props.lockedIntentFocus,
      },
      "Sign up form"
    ),
}))

vi.mock("@/components/public/legacy-home-sections", () => ({
  LegacyHomeAcceleratorSection: () =>
    createElement("section", null, "Accelerator"),
  LegacyHomeHeroSection: () => createElement("section", null, "Hero"),
  LegacyHomeOfferingsSection: () => createElement("section", null, "Platform"),
  LegacyHomeProcessSection: () => createElement("section", null, "Process"),
  LegacyHomeTeamSection: () => createElement("section", null, "Team"),
}))

import { CanvasAuthPanel } from "@/components/public/home-canvas-preview-panels"

describe("home canvas auth panel", () => {
  it("routes returning users from the login panel back into the workspace", () => {
    const markup = renderToStaticMarkup(
      createElement(CanvasAuthPanel, { mode: "login" })
    )

    expect(markup).toContain('data-login-redirect-to="/workspace"')
    expect(markup).toContain("Login panel")
  })

  it("honors a selected login redirect from the home auth URL", () => {
    const markup = renderToStaticMarkup(
      createElement(CanvasAuthPanel, {
        loginRedirectTo: "/api/stripe/checkout?plan=organization",
        mode: "login",
      })
    )

    expect(markup).toContain(
      'data-login-redirect-to="/api/stripe/checkout?plan=organization"'
    )
  })

  it("preserves an organization invite through the homepage signup panel", () => {
    const markup = renderToStaticMarkup(createElement(CanvasAuthPanel, {
      mode: "signup",
      loginRedirectTo: "/join-organization?token=invite_123",
      signupPlanTier: "organization",
    }))
    expect(markup).toContain('data-builder-redirect-to="/join-organization?token=invite_123"')
    expect(markup).toContain('data-member-redirect-to="/join-organization?token=invite_123"')
    expect(markup).toContain('data-locked-intent-focus="support"')
    expect(markup).not.toContain("secure checkout")
  })

  it("defaults free signup to post-confirmation onboarding", () => {
    const markup = renderToStaticMarkup(
      createElement(CanvasAuthPanel, { mode: "signup" })
    )

    expect(markup).toContain("After email verification")
    expect(markup).toContain(
      "building, finding, funding, or supporting nonprofit work"
    )
    expect(markup).toContain('data-default-intent-focus="build"')
    expect(markup).not.toContain("data-locked-intent-focus")
    expect(markup).toContain(
      'data-builder-redirect-to="/onboarding?source=home_signup"'
    )
    expect(markup).toContain(
      'data-member-redirect-to="/onboarding?source=home_signup"'
    )
    expect(markup).toContain('class="mb-3 space-y-1"')
    expect(markup).not.toContain('class="mb-5 space-y-1"')
    expect(markup).toContain("Sign up form")
  })

  it("locks paid pricing signup to builder checkout after email verification", () => {
    const markup = renderToStaticMarkup(
      createElement(CanvasAuthPanel, {
        mode: "signup",
        signupPlanTier: "organization",
      })
    )

    expect(markup).toContain("continue with Organization")
    expect(markup).toContain("secure checkout")
    expect(markup).toContain('data-default-intent-focus="build"')
    expect(markup).toContain('data-locked-intent-focus="build"')
    expect(markup).toContain(
      'data-builder-redirect-to="/api/stripe/checkout?plan=organization&amp;source=home_signup'
    )
    expect(markup).toContain(
      "redirect=%2Fonboarding%3Fsource%3Donboarding_pricing"
    )
    expect(markup).toContain(
      "cancel=%2Fonboarding%3Fsource%3Donboarding_pricing"
    )
  })
})
