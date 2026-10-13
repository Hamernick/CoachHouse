import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSubscriptionPeriodEndIso } from "@/lib/billing/subscription-period"

import { captureRedirect, resetTestMocks } from "./test-utils"

const {
  requireServerSessionMock,
  resolveDevtoolsAudienceMock,
  resolveTesterMetadataMock,
  resolveStripeRuntimeConfigsForFallbackMock,
  maybeStartOrganizationTrialFromAcceleratorMock,
  createSupabaseAdminClientMock,
} = vi.hoisted(() => ({
  requireServerSessionMock: vi.fn(),
  resolveDevtoolsAudienceMock: vi.fn(),
  resolveTesterMetadataMock: vi.fn(),
  resolveStripeRuntimeConfigsForFallbackMock: vi.fn(),
  maybeStartOrganizationTrialFromAcceleratorMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireServerSession: requireServerSessionMock,
}))

vi.mock("@/lib/devtools/audience", () => ({
  resolveDevtoolsAudience: resolveDevtoolsAudienceMock,
  resolveTesterMetadata: resolveTesterMetadataMock,
}))

vi.mock("@/lib/billing/stripe-runtime", () => ({
  resolveStripeRuntimeConfigsForFallback: resolveStripeRuntimeConfigsForFallbackMock,
}))

vi.mock("@/app/(public)/pricing/success/_lib/success-helpers", () => ({
  maybeStartOrganizationTrialFromAccelerator: maybeStartOrganizationTrialFromAcceleratorMock,
}))

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase")
  return {
    ...actual,
    createSupabaseAdminClient: createSupabaseAdminClientMock,
  }
})

describe("pricing success return handling", () => {
  const subscriptionsUpsertMock = vi.fn().mockResolvedValue({ data: null, error: null })

  beforeEach(() => {
    resetTestMocks()
    vi.clearAllMocks()
    subscriptionsUpsertMock.mockReset().mockResolvedValue({ data: null, error: null })
    resolveTesterMetadataMock.mockReturnValue(false)
    resolveDevtoolsAudienceMock.mockResolvedValue({ isTester: false })
    createSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        upsert: subscriptionsUpsertMock,
      })),
    })
    requireServerSessionMock.mockResolvedValue({
      supabase: {},
      session: {
        user: {
          id: "user_123",
          user_metadata: {},
        },
      },
    })
  })

  it("returns successful subscriptions to the onboarding workspace path", async () => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_success",
                mode: "subscription",
                client_reference_id: "user_123",
                metadata: {},
                subscription: {
                  id: "sub_success",
                  status: "active",
                  customer: "cus_success",
                  metadata: {
                    kind: "organization",
                    planName: "Operations Support",
                    plan_tier: "operations_support",
                  },
                },
              }),
            },
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    subscriptionsUpsertMock.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } })
    const pending = await Page({ searchParams: Promise.resolve({
      session_id: "cs_test_success",
      redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing",
    }) })
    expect(pending.props.returnHref).toBe("/workspace?onboarding_flow=1&source=onboarding_pricing")

    const destination = await captureRedirect(() =>
      Page({
        searchParams: Promise.resolve({
          session_id: "cs_test_success",
          redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing",
        }),
      }),
    )

    expect(destination).toBe(
      "/workspace?onboarding_flow=1&source=onboarding_pricing&checkout=success&plan=operations_support",
    )
  })

  it("keeps the checkout recoverable when subscription sync fails", async () => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_success_sync_failure",
                mode: "subscription",
                client_reference_id: "user_123",
                metadata: {},
                subscription: {
                  id: "sub_success_sync_failure",
                  status: "active",
                  customer: "cus_success_sync_failure",
                  metadata: {
                    kind: "organization",
                    planName: "Organization",
                    plan_tier: "organization",
                  },
                },
              }),
            },
          },
        },
        mode: "live",
      },
    ])
    createSupabaseAdminClientMock.mockImplementation(() => {
      throw new Error("missing_service_role")
    })

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const result = await Page({
      searchParams: Promise.resolve({ session_id: "cs_test_success_sync_failure", redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing" }),
    })
    expect(result.props.returnHref).toBe("/workspace?onboarding_flow=1&source=onboarding_pricing")
    expect(result.props.paymentRequired).not.toBe(true)

  })

  it("waits for subscription expansion before reporting success", async () => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_success_no_subscription",
                mode: "subscription",
                status: "complete",
                payment_status: "no_payment_required",
                client_reference_id: "user_123",
                metadata: {
                  kind: "organization",
                  planName: "Operations Support",
                  plan_tier: "operations_support",
                },
                subscription: null,
              }),
            },
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const result = await Page({
      searchParams: Promise.resolve({ session_id: "cs_test_success_no_subscription", redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing" }),
    })
    expect(result.props.returnHref).toBe("/workspace?onboarding_flow=1&source=onboarding_pricing")
    expect(result.props.paymentRequired).not.toBe(true)

  })

  it("hydrates a string subscription id before persisting the local subscription row", async () => {
    const retrieveSubscriptionMock = vi.fn().mockResolvedValue({
      id: "sub_string_hydrated",
      status: "active",
      customer: "cus_string_hydrated",
      metadata: {
        kind: "organization",
        planName: "Organization",
        plan_tier: "organization",
      },
      items: { data: [{ current_period_end: 1_799_452_800 }] },
    })
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_string_subscription",
                mode: "subscription",
                client_reference_id: "user_123",
                metadata: {
                  kind: "organization",
                  planName: "Organization",
                  plan_tier: "organization",
                },
                subscription: "sub_string_hydrated",
              }),
            },
          },
          subscriptions: {
            retrieve: retrieveSubscriptionMock,
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const destination = await captureRedirect(() =>
      Page({
        searchParams: Promise.resolve({
          session_id: "cs_test_string_subscription",
          redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing",
        }),
      }),
    )

    expect(retrieveSubscriptionMock).toHaveBeenCalledWith("sub_string_hydrated")
    expect(subscriptionsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: "sub_string_hydrated",
        stripe_customer_id: "cus_string_hydrated",
        status: "active",
      }),
      { onConflict: "user_id,stripe_subscription_id" },
    )
    expect(destination).toBe(
      "/workspace?onboarding_flow=1&source=onboarding_pricing&checkout=success&plan=organization",
    )
  })

  it.each([
    ["organization", "Organization"],
    ["operations_support", "Operations Support"],
  ] as const)("persists %s sidebar upgrade subscriptions before returning to the workspace", async (planTier, planName) => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_sidebar_upgrade",
                mode: "subscription",
                client_reference_id: "user_123",
                metadata: {
                  kind: "organization",
                  planName,
                  plan_tier: planTier,
                  org_user_id: "org_456",
                },
                subscription: {
                  id: "sub_sidebar_upgrade",
                  status: "active",
                  customer: "cus_sidebar_upgrade",
                  metadata: {
                    kind: "organization",
                    stripe_mode: "test",
                  },
                  items: { data: [{ current_period_end: 1_799_452_800 }] },
                },
              }),
            },
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const destination = await captureRedirect(() =>
      Page({
        searchParams: Promise.resolve({
          session_id: "cs_test_sidebar_upgrade",
          redirect: "/workspace",
        }),
      }),
    )

    expect(subscriptionsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "org_456",
        stripe_subscription_id: "sub_sidebar_upgrade",
        stripe_customer_id: "cus_sidebar_upgrade",
        status: "active",
        current_period_end: "2027-01-09T00:00:00.000Z",
        metadata: expect.objectContaining({
          kind: "organization",
          plan_tier: planTier,
          stripe_mode: "live",
        }),
      }),
      { onConflict: "user_id,stripe_subscription_id" },
    )
    expect(destination).toBe(`/workspace?checkout=success&plan=${planTier}`)
  })

  it.each(["incomplete", "past_due", "unpaid", "canceled", "paused"])("shows billing recovery for %s subscriptions", async (status) => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockResolvedValue({
                id: "cs_test_incomplete",
                mode: "subscription",
                client_reference_id: "user_123",
                metadata: {},
                subscription: {
                  id: "sub_incomplete",
                  status,
                  customer: "cus_incomplete",
                  metadata: {
                    kind: "organization",
                    planName: "Organization",
                    plan_tier: "organization",
                  },
                },
              }),
            },
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const result = await Page({
      searchParams: Promise.resolve({ session_id: "cs_test_incomplete", redirect: "/workspace?onboarding_flow=1&source=onboarding_pricing" }),
    })
    expect(result.props.returnHref).toBe("/workspace?onboarding_flow=1&source=onboarding_pricing")
    expect(result.props.paymentRequired).toBe(true)

  })

  it("keeps a failed checkout lookup available for retry", async () => {
    resolveStripeRuntimeConfigsForFallbackMock.mockReturnValue([
      {
        client: {
          checkout: {
            sessions: {
              retrieve: vi.fn().mockRejectedValue(new Error("session_lookup_failed")),
            },
          },
        },
        mode: "live",
      },
    ])

    const Page = (await import("@/app/(public)/pricing/success/page")).default
    const result = await Page({
      searchParams: Promise.resolve({ session_id: "cs_test_failed_lookup", redirect: "/onboarding?source=onboarding_pricing" }),
    })
    expect(result.props.returnHref).toBe("/onboarding?source=onboarding_pricing")
    expect(result.props.paymentRequired).not.toBe(true)

  })
})


describe("subscription renewal dates", () => {
  it("reads legacy webhook dates", () => {
    expect(getSubscriptionPeriodEndIso({ current_period_end: 1_799_452_800 })).toBe("2027-01-09T00:00:00.000Z")
  })

  it("uses the next item renewal instead of a stale legacy date", () => {
    expect(getSubscriptionPeriodEndIso({
      current_period_end: 1_700_000_000,
      items: { data: [{ current_period_end: 1_900_000_000 }, { current_period_end: 1_799_452_800 }] },
    })).toBe("2027-01-09T00:00:00.000Z")
  })

  it("leaves absent or invalid dates unset", () => {
    expect(getSubscriptionPeriodEndIso({ items: { data: [] } })).toBeNull()
    expect(getSubscriptionPeriodEndIso({ current_period_end: NaN })).toBeNull()
  })
})
