import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveOnboardingRequirements } from "@/lib/onboarding/requirements"
import { resolveAppShellOnboardingRedirectTarget } from "@/components/app-shell/onboarding-redirect"

// Compile the mocked page before timed cases; per-case factories still reload
// after resetModules, without a cold transform outliving a case’s mocks.
import "@/app/(dashboard)/onboarding/page"

import {
  captureRedirect,
  createSupabaseServerClientServerMock,
  redirectMock,
  resetTestMocks,
} from "./test-utils"

const fetchLearningEntitlementsMock = vi.hoisted(() => vi.fn())
const resolveActiveOrganizationMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/accelerator/entitlements", () => ({
  fetchLearningEntitlements: fetchLearningEntitlementsMock,
}))

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: resolveActiveOrganizationMock,
}))

vi.mock("@/components/app-shell/dashboard-layout-state", () => ({
  resolveDashboardLayoutState: async () => ({}),
}))
vi.mock("@/components/onboarding/onboarding-workspace-card", () => ({
  OnboardingWorkspaceCard: () => null,
}))

describe("onboarding gate", () => {
  beforeEach(() => {
    resetTestMocks()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("redirects completed builder users to workspace", async () => {
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true,
        onboardingLocked: false,
        onboardingIntentFocus: "build",
      }),
    }))
    vi.doMock("@/components/onboarding/onboarding-workspace-card", () => ({
      OnboardingWorkspaceCard: () => null,
    }))

    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const destination = await captureRedirect(() => Page())
    expect(destination).toBe("/workspace")
  })

  it("redirects completed member-intent users to workspace", async () => {
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true,
        onboardingLocked: false,
        onboardingIntentFocus: "find",
      }),
    }))
    vi.doMock("@/components/onboarding/onboarding-workspace-card", () => ({
      OnboardingWorkspaceCard: () => null,
    }))

    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const destination = await captureRedirect(() => Page())
    expect(destination).toBe("/workspace")
  })

  it("renders onboarding workspace card while onboarding is still locked", async () => {
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true,
        onboardingLocked: true,
        onboardingIntentFocus: "build",
        onboardingDefaults: {},
        currentPlanTier: "free",
      }),
    }))
    vi.doMock("@/components/onboarding/onboarding-workspace-card", () => ({
      OnboardingWorkspaceCard: () => "onboarding-workspace-card",
    }))

    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const result = await Page()

    expect(result).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
    expect(
      (result as { props: { className: string } }).props.className
    ).toContain("min-h-0")
    expect(
      (result as { props: { className: string } }).props.className
    ).toContain("py-0")
  })

  it("opens the existing setup form for an unfinished paid owner instead of restarting pricing", async () => {
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true, onboardingLocked: true, onboardingIntentFocus: "build",
        onboardingMode: "workspace_setup", currentPlanTier: "operations_support",
        onboardingDefaults: { defaultOrgName: null, defaultEmail: "review@example.com" },
      }),
    }))
    vi.doMock("@/components/onboarding/onboarding-workspace-card", () => ({
      OnboardingWorkspaceCard: () => null,
    }))
    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const result = await Page()
    expect(result.props.children.props).toMatchObject({
      mode: "workspace_setup", defaultBuilderPlanTier: "operations_support", defaultEmail: "review@example.com",
    })
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("returns a completed owner with missing basics from onboarding to a workspace that does not redirect back", async () => {
    const requirements = resolveOnboardingRequirements({
      userId: "returning-owner",
      organizationId: "returning-owner",
      isPlatformStaff: false,
      userMetadata: {
        onboarding_completed: true,
        onboarding_intent_focus: "build",
        workspace_onboarding_stage: 2,
      },
      organizationProfile: { roadmap: { sections: [{ id: "vision", content: "Saved work" }] } },
      publicSlug: null,
    })
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true,
        onboardingLocked: requirements.required,
        onboardingMode: requirements.mode,
        onboardingIntentFocus: "build",
        onboardingDefaults: {},
      }),
    }))
    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const destination = await captureRedirect(() => Page())
    expect(destination).toBe("/workspace")
    expect(resolveAppShellOnboardingRedirectTarget({
      onboardingLocked: requirements.required,
      isAdminContext: false,
      pathname: destination,
    })).toBeNull()
    expect(fetchLearningEntitlementsMock).not.toHaveBeenCalled()
  })

  it("recovers a paid onboarding pricing return from Stripe-backed entitlements when the local subscription row was missing before sync", async () => {
    vi.doMock("@/components/app-shell/dashboard-layout-state", () => ({
      resolveDashboardLayoutState: async () => ({
        userPresent: true,
        onboardingLocked: true,
        onboardingIntentFocus: "build",
        onboardingDefaults: {},
        currentPlanTier: "free",
        isAdmin: false,
      }),
    }))
    vi.doMock("@/components/onboarding/onboarding-workspace-card", () => ({
      OnboardingWorkspaceCard: (props: unknown) => props,
    }))
    createSupabaseServerClientServerMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user_123",
            },
          },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            status: "active",
            metadata: {
              plan_tier: "organization",
            },
          },
          error: null,
        }),
      })),
    })
    resolveActiveOrganizationMock.mockResolvedValue({
      orgId: "org_123",
      role: "owner",
    })
    fetchLearningEntitlementsMock.mockResolvedValue({
      hasAcceleratorPurchase: false,
      hasActiveSubscription: true,
      hasAcceleratorAccess: true,
      hasElectiveAccess: true,
      ownedElectiveModuleSlugs: [],
    })

    const { default: Page } = await import("@/app/(dashboard)/onboarding/page")
    const result = await Page({
      searchParams: Promise.resolve({
        source: "onboarding_pricing",
      }),
    })

    expect(result).toBeTruthy()
    expect(fetchLearningEntitlementsMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: "user_123",
      orgUserId: "org_123",
      isAdmin: false,
      forceStripeSync: true,
    })
    const child = (
      result as { props: { children: { props: Record<string, unknown> } } }
    ).props.children
    expect(child.props).toEqual(
      expect.objectContaining({
        defaultBuilderPlanTier: "organization",
        mode: "post_signup_access",
      })
    )
  })

  it("completes member map onboarding without overwriting profile fields", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })
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
        updateUser,
      },
    })

    const { completeMemberMapOnboardingAction } =
      await import("@/actions/member-map-onboarding")
    const form = new FormData()
    form.set("intentFocus", "support")

    const destination = await captureRedirect(() =>
      completeMemberMapOnboardingAction(form)
    )

    expect(destination).toBe("/resources?member_onboarding=0&source=member_onboarding")
    expect(updateUser).toHaveBeenCalledWith({
      data: expect.objectContaining({
        onboarding_completed: true,
        onboarding_intent_focus: "support",
      }),
    })
    expect(updateUser.mock.calls[0]?.[0].data).not.toHaveProperty("first_name")
    expect(updateUser.mock.calls[0]?.[0].data).not.toHaveProperty("last_name")
    expect(updateUser.mock.calls[0]?.[0].data).not.toHaveProperty("full_name")
  })
})
