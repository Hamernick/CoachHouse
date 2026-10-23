import "./test-utils"

import { FISCAL_SPONSORSHIP_APPLY_HREF } from "@/features/fiscal-sponsorship/lib/public-entry"
import { PLATFORM_TIERS } from "@/components/public/pricing-surface-data"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  captureRedirect,
  createSupabaseServerClientServerMock,
  resetTestMocks,
} from "./test-utils"

describe("sign up page", () => {
  beforeEach(() => {
    resetTestMocks()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it.each(PLATFORM_TIERS)("preserves $title card selection for anonymous and signed-in visitors", async (tier) => {
    const query = Object.fromEntries(new URL(tier.ctaHref, "https://coachhouse.app").searchParams)
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const page = await SignUpPage({ searchParams: Promise.resolve(query) })
    const form = page.props.children.props.children
    expect(form.props.lockedIntentFocus).toBe("build")
    expect(form.props.signUpMetadata.onboarding_selected_builder_plan_tier).toBe(query.plan)
    const target = new URL(form.props.builderRedirectTo, "https://coachhouse.app")
    expect(target.pathname).toBe(query.plan === "free" ? "/onboarding" : "/api/stripe/checkout")
    expect(target.searchParams.get("plan")).toBe(query.plan)
    if (query.plan !== "free") {
      expect(target.searchParams.get("redirect")).toBe("/onboarding?source=onboarding_pricing")
      expect(target.searchParams.get("cancel")).toBe("/onboarding?source=onboarding_pricing")
    }
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "signed-in-user" } }, error: null }) },
    })
    expect(await captureRedirect(() => SignUpPage({ searchParams: Promise.resolve(query) })))
      .toBe(form.props.builderRedirectTo)
  })

  it("redirects deprecated individual-plan links to the canonical signup flow", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })

    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const destination = await captureRedirect(() =>
      SignUpPage({
        searchParams: Promise.resolve({
          plan: "individual",
          redirect: "/find",
          source: "pricing",
        }),
      })
    )

    expect(destination).toBe("/sign-up?redirect=%2Ffind&source=pricing")
  })

  it("keeps invited signup on the team path even with a builder plan", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const page = await SignUpPage({ searchParams: Promise.resolve({
      redirect: "/join-organization?token=invite_123", plan: "organization",
    }) })
    const form = page.props.children.props.children
    expect(form.props.lockedIntentFocus).toBe("support")
    expect(form.props.builderRedirectTo).toBe("/join-organization?token=invite_123")
    expect(form.props.memberRedirectTo).toBe("/join-organization?token=invite_123")
    expect(form.props.signUpMetadata).toBeUndefined()
  })

  it("routes signed-in member-intent users into onboarding", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user_123",
              email: "member@example.com",
            },
          },
          error: null,
        }),
      },
    })

    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const destination = await captureRedirect(() =>
      SignUpPage({
        searchParams: Promise.resolve({
          intent: "find",
        }),
      })
    )

    expect(destination).toBe("/onboarding?source=signup")
  })

  it("routes signed-in generic signup users into onboarding instead of find", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user_123",
              email: "builder@example.com",
            },
          },
          error: null,
        }),
      },
    })

    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const destination = await captureRedirect(() =>
      SignUpPage({
        searchParams: Promise.resolve({}),
      })
    )

    expect(destination).toBe("/onboarding?source=signup")
  })

  it("returns signed-in applicants to fiscal sponsorship rather than donor onboarding", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "applicant" } }, error: null }) },
    })
    const params = { intent: "build", redirect: FISCAL_SPONSORSHIP_APPLY_HREF }
    expect(params.intent).toBe("build")
    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    expect(await captureRedirect(() => SignUpPage({ searchParams: Promise.resolve(params) })))
      .toBe("/documentation/fiscal-sponsorship#application")
  })

  it("passes the fiscal return destination into the existing signup form", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })
    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const page = await SignUpPage({ searchParams: Promise.resolve({ intent: "build", redirect: "/documentation/fiscal-sponsorship#application" }) })
    const form = page.props.children.props.children
    expect(form.props.loginHref).toBe("/login")
    expect(form.props.memberRedirectTo).toBe("/documentation/fiscal-sponsorship#application")
    expect(form.props.builderRedirectTo).toBe("/documentation/fiscal-sponsorship#application")
  })

  it("routes signed-in paid-plan signup links straight into checkout", async () => {
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user_123",
              email: "builder@example.com",
            },
          },
          error: null,
        }),
      },
    })

    const { default: SignUpPage } = await import("@/app/(auth)/sign-up/page")
    const destination = await captureRedirect(() =>
      SignUpPage({
        searchParams: Promise.resolve({
          plan: "operations_support",
        }),
      })
    )

    expect(destination).toBe(
      "/api/stripe/checkout?plan=operations_support&source=signup&redirect=%2Fonboarding%3Fsource%3Donboarding_pricing&cancel=%2Fonboarding%3Fsource%3Donboarding_pricing&context=onboarding_builder"
    )
  })
})
