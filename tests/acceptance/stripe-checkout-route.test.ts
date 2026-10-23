import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const {
  createSupabaseRouteHandlerClientMock,
  resolveActiveOrganizationMock,
  resolveDevtoolsAudienceMock,
  resolveTesterMetadataMock,
  resolveStripeRuntimeConfigForAudienceMock,
  resolveStripePriceIdForPlanMock,
} = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
  resolveActiveOrganizationMock: vi.fn(),
  resolveDevtoolsAudienceMock: vi.fn(),
  resolveTesterMetadataMock: vi.fn(),
  resolveStripeRuntimeConfigForAudienceMock: vi.fn(),
  resolveStripePriceIdForPlanMock: vi.fn(),
}))

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase")
  return {
    ...actual,
    createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
  }
})

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: resolveActiveOrganizationMock,
}))

vi.mock("@/lib/devtools/audience", () => ({
  resolveDevtoolsAudience: resolveDevtoolsAudienceMock,
  resolveTesterMetadata: resolveTesterMetadataMock,
}))

vi.mock("@/lib/billing/stripe-runtime", () => ({
  resolveStripeRuntimeConfigForAudience: resolveStripeRuntimeConfigForAudienceMock,
  resolveStripePriceIdForPlan: resolveStripePriceIdForPlanMock,
}))

vi.mock("@/lib/billing/stripe-checkout-diagnostics", () => ({
  collectStripeCheckoutPriceDiagnostics: vi.fn(),
}))

describe("stripe checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveTesterMetadataMock.mockReturnValue(false)
    resolveDevtoolsAudienceMock.mockResolvedValue({ isTester: false })
    resolveActiveOrganizationMock.mockResolvedValue({ orgId: "org_123", role: "owner" })
    resolveStripePriceIdForPlanMock.mockReturnValue("price_ops")
  })

  it("preserves onboarding return params when redirecting unauthenticated users to login", async () => {
    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })

    const { GET } = await import("@/app/api/stripe/checkout/route")
    const request = new NextRequest(
      "http://localhost/api/stripe/checkout?plan=operations_support&source=onboarding&redirect=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&cancel=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&context=onboarding_builder",
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?source=onboarding&redirect=%2Fapi%2Fstripe%2Fcheckout%3Fplan%3Doperations_support%26source%3Donboarding%26redirect%3D%252Fworkspace%253Fonboarding_flow%253D1%2526source%253Donboarding_pricing%26cancel%3D%252Fworkspace%253Fonboarding_flow%253D1%2526source%253Donboarding_pricing%26context%3Donboarding_builder",
    )
  })

  it("returns checkout setup errors back to the onboarding workspace path", async () => {
    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user_123", email: "builder@example.test", user_metadata: {} } },
        }),
      },
    })
    resolveStripeRuntimeConfigForAudienceMock.mockReturnValue(null)

    const { GET } = await import("@/app/api/stripe/checkout/route")
    const request = new NextRequest(
      "http://localhost/api/stripe/checkout?plan=organization&source=onboarding&redirect=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&cancel=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing",
    )

    const response = await GET(request)
    const location = response.headers.get("location")

    expect(response.status).toBe(307)
    expect(location).toContain(
      "http://localhost/workspace?onboarding_flow=1&source=onboarding_pricing",
    )
    expect(location).toContain("checkout_error=stripe_unavailable")
    expect(location).toContain("paywall=organization")
    expect(new URL(location!).searchParams.get("redirect")).toBe("/workspace?onboarding_flow=1&source=onboarding_pricing")
  })

  it("adds cancelled=true to the onboarding cancel return URL sent to Stripe", async () => {
    const stripeCheckoutCreateMock = vi.fn().mockResolvedValue({
      url: "https://checkout.stripe.test/session_123",
    })

    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user_123", email: "builder@example.test", user_metadata: {} } },
        }),
      },
    })
    resolveStripeRuntimeConfigForAudienceMock.mockReturnValue({
      client: {
        checkout: {
          sessions: {
            create: stripeCheckoutCreateMock,
          },
        },
      },
      mode: "live",
      target: "live",
    })

    const { GET } = await import("@/app/api/stripe/checkout/route")
    const request = new NextRequest(
      "http://localhost/api/stripe/checkout?plan=operations_support&source=onboarding&redirect=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&cancel=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&context=onboarding_builder",
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://checkout.stripe.test/session_123")
    // Stripe substitutes only the literal token in the URL supplied to Checkout.
    const successUrl = stripeCheckoutCreateMock.mock.calls[0][0].success_url as string
    const returnedUrl = new URL(successUrl.replace("{CHECKOUT_SESSION_ID}", "cs_test_completed"))
    expect(returnedUrl.searchParams.get("session_id")).toBe("cs_test_completed")
    expect(returnedUrl.searchParams.get("redirect")).toBe(
      "/workspace?onboarding_flow=1&source=onboarding_pricing",
    )
    expect(returnedUrl.searchParams.get("context")).toBe("onboarding_builder")
    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url:
          "http://localhost/workspace?onboarding_flow=1&source=onboarding_pricing&cancelled=true",
        success_url: expect.stringContaining(
          "/pricing/success?session_id={CHECKOUT_SESSION_ID}&redirect=%2Fworkspace%3Fonboarding_flow%3D1%26source%3Donboarding_pricing&context=onboarding_builder",
        ),
      }),
    )
  })

  it.each([
    ["organization", "Organization"],
    ["operations_support", "Operations Support"],
  ] as const)("preserves sidebar upgrade return targets in %s Stripe checkout URLs", async (planTier, planName) => {
    const stripeCheckoutCreateMock = vi.fn().mockResolvedValue({
      url: "https://checkout.stripe.test/sidebar-session",
    })

    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user_123", email: "free@example.test", user_metadata: {} } },
        }),
      },
    })
    resolveStripeRuntimeConfigForAudienceMock.mockReturnValue({
      client: {
        checkout: {
          sessions: {
            create: stripeCheckoutCreateMock,
          },
        },
      },
      mode: "live",
      target: "live",
    })

    const { GET } = await import("@/app/api/stripe/checkout/route")
    const request = new NextRequest(
      `http://localhost/api/stripe/checkout?plan=${planTier}&source=sidebar_upgrade&redirect=%2Fworkspace&cancel=%2Ffind`,
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://checkout.stripe.test/sidebar-session")
    expect(resolveStripePriceIdForPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planTier,
      }),
    )
    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining(
          "/pricing/success?session_id={CHECKOUT_SESSION_ID}&redirect=%2Fworkspace",
        ),
        cancel_url: "http://localhost/find?cancelled=true",
        metadata: expect.objectContaining({
          planName,
          plan_tier: planTier,
          redirect_after_success: "/workspace",
        }),
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({
            planName,
            plan_tier: planTier,
            redirect_after_success: "/workspace",
          }),
        }),
      }),
    )
  })
  it("does not start a purchase when the selected organization cannot be resolved", async () => {
    const create = vi.fn()
    createSupabaseRouteHandlerClientMock.mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "buyer", email: "buyer@example.test", user_metadata: {} } },
    }) } })
    resolveStripeRuntimeConfigForAudienceMock.mockReturnValue({ client: { checkout: { sessions: { create } } }, mode: "live" })
    resolveActiveOrganizationMock.mockRejectedValueOnce(new Error("organization unavailable"))
    const { GET } = await import("@/app/api/stripe/checkout/route")
    const response = await GET(new NextRequest("http://localhost/api/stripe/checkout?plan=organization&redirect=%2Fworkspace"))
    expect(create).not.toHaveBeenCalled()
    expect(response.headers.get("location")).toContain("checkout_detail=organization_unavailable")
    expect(response.headers.get("location")).toContain("paywall=organization")
  })

})
