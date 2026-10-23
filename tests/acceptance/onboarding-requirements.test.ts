import { describe, expect, it } from "vitest"
import { resolveAppShellOnboardingRedirectTarget } from "@/components/app-shell/onboarding-redirect"
import { resolveOnboardingRequirements } from "@/lib/onboarding/requirements"

const complete = {
  userId: "owner",
  organizationId: "owner",
  isPlatformStaff: false,
  userMetadata: {
    onboarding_completed: true,
    onboarding_intent_focus: "build",
  },
  organizationProfile: { name: "Community House", formationStatus: "approved" },
  publicSlug: "community-house",
}

describe("saved onboarding requirements", () => {
  it.each([0, 1, "2", NaN, Infinity])(
    "does not treat invalid/early stage %s as selected access",
    (stage) => {
      expect(
        resolveOnboardingRequirements({
          ...complete,
          userMetadata: {
            onboarding_intent_focus: "build",
            onboarding_completed: false,
            workspace_onboarding_stage: stage,
          },
          organizationProfile: null,
          publicSlug: null,
        })
      ).toMatchObject({ required: true, mode: "post_signup_access" })
    }
  )

  it("keeps a completed owner with saved work in the workspace", () => {
    expect(
      resolveOnboardingRequirements({
        ...complete,
        organizationProfile: { roadmap: { sections: ["saved-vision"] } },
        publicSlug: null,
      })
    ).toEqual({
      required: false,
      mode: "workspace_setup",
      organizationSetupComplete: false,
    })
  })

  it.each([
    [null, null],
    [{}, null],
    [{ name: "", formationStatus: "approved" }, "community-house"],
    [{ name: "   ", formationStatus: "approved" }, "community-house"],
    [{ name: "Community House", formationStatus: "approved" }, ""],
    [{ name: "Community House", formationStatus: "approved" }, null],
  ])(
    "does not revoke completed onboarding when organization details are missing",
    (organizationProfile, publicSlug) => {
      const requirements = resolveOnboardingRequirements({
        ...complete,
        organizationProfile,
        publicSlug,
      })
      expect(requirements).toMatchObject({ required: false, organizationSetupComplete: false })
      for (const pathname of ["/workspace", "/accelerator", "/organization"]) {
        expect(resolveAppShellOnboardingRedirectTarget({
          onboardingLocked: requirements.required,
          isAdminContext: false,
          pathname,
        })).toBeNull()
      }
    }
  )

  it.each([false, undefined, null, "true", 1])(
    "still requires onboarding for an uncompleted account (%s), even with organization details",
    (onboardingCompleted) => {
      const requirements = resolveOnboardingRequirements({
        ...complete,
        userMetadata: { ...complete.userMetadata, onboarding_completed: onboardingCompleted },
      })
      expect(requirements.required).toBe(true)
      expect(resolveAppShellOnboardingRedirectTarget({
        onboardingLocked: requirements.required,
        isAdminContext: false,
        pathname: "/workspace",
      })).toBe("/onboarding?source=onboarding")
    }
  )

  it.each(["pre_501c3", "in_progress", "approved"])(
    "accepts a completed organization with %s status",
    (formationStatus) => {
      expect(
        resolveOnboardingRequirements({
          ...complete,
          organizationProfile: {
            ...complete.organizationProfile,
            formationStatus,
          },
        }).required
      ).toBe(false)
    }
  )

  it("allows completed builders to enter before answering formation status", () => {
    expect(resolveOnboardingRequirements({ ...complete, organizationProfile: { name: "Community House" } }).required).toBe(false)
  })

  it("routes a fresh Google organization signup through onboarding", () => {
    const requirements = resolveOnboardingRequirements({ ...complete, userMetadata: { full_name: "Google User", avatar_url: "https://example.com/avatar.jpg", onboarding_intent_focus: "build", email_verified: true }, organizationProfile: null, publicSlug: null })
    expect(requirements).toMatchObject({ required: true, mode: "post_signup_access" })
    expect(resolveAppShellOnboardingRedirectTarget({ onboardingLocked: requirements.required, onboardingIntentFocus: "build", isAdminContext: false, pathname: "/workspace" })).toBe("/onboarding?source=onboarding")
  })

  it("keeps fresh builders on access selection before organization setup", () => {
    expect(
      resolveOnboardingRequirements({
        ...complete,
        userMetadata: { onboarding_intent_focus: "build" },
        organizationProfile: null,
        publicSlug: null,
      })
    ).toMatchObject({ required: true, mode: "post_signup_access" })
  })

  it("advances builders to setup after access selection while keeping completion required", () => {
    expect(
      resolveOnboardingRequirements({
        ...complete,
        userMetadata: {
          onboarding_intent_focus: "build",
          onboarding_completed: false,
          workspace_onboarding_stage: 2,
        },
        organizationProfile: null,
        publicSlug: null,
      })
    ).toMatchObject({ required: true, mode: "workspace_setup" })
  })

  it.each(["find", "fund", "support"])(
    "does not require an organization for completed %s members",
    (intent) => {
      expect(
        resolveOnboardingRequirements({
          ...complete,
          userMetadata: {
            onboarding_completed: true,
            onboarding_intent_focus: intent,
          },
          organizationProfile: null,
          publicSlug: null,
        }).required
      ).toBe(false)
      expect(
        resolveOnboardingRequirements({
          ...complete,
          userMetadata: {
            onboarding_completed: false,
            onboarding_intent_focus: intent,
          },
          organizationProfile: null,
          publicSlug: null,
        }).required
      ).toBe(true)
    }
  )

  it("does not force invited members or platform staff to create organizations", () => {
    expect(
      resolveOnboardingRequirements({
        ...complete,
        organizationId: "inviting-organization",
        organizationProfile: null,
      }).required
    ).toBe(false)
    expect(
      resolveOnboardingRequirements({
        ...complete,
        isPlatformStaff: true,
        organizationProfile: null,
      }).required
    ).toBe(false)
  })

  it("keeps completion decisions read-only", () => {
    const input = structuredClone(complete)
    const before = structuredClone(input)
    resolveOnboardingRequirements(input)
    expect(input).toEqual(before)
  })
})
