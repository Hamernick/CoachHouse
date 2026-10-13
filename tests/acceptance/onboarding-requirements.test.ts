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

  it("recovers the legacy completed owner without requiring another plan selection", () => {
    expect(
      resolveOnboardingRequirements({
        ...complete,
        organizationProfile: { roadmap: { sections: ["saved-vision"] } },
        publicSlug: null,
      })
    ).toEqual({
      required: true,
      mode: "workspace_setup",
      organizationSetupComplete: false,
    })
  })

  it.each([
    [{ name: "", formationStatus: "approved" }, "community-house"],
    [{ name: "   ", formationStatus: "approved" }, "community-house"],
    [{ name: "Community House", formationStatus: "approved" }, ""],
    [{ name: "Community House", formationStatus: "approved" }, null],
  ])(
    "requires each missing organization field despite completion metadata",
    (organizationProfile, publicSlug) => {
      expect(
        resolveOnboardingRequirements({
          ...complete,
          organizationProfile,
          publicSlug,
        }).required
      ).toBe(true)
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
