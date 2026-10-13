import { describe, expect, it, vi } from "vitest"

import { buildOnboardingFlowDefaults } from "@/lib/onboarding/defaults"
import { buildSavedOnboardingFlowDefaults } from "@/lib/onboarding/saved-defaults"

vi.mock("server-only", () => ({}))

const recoveryInput = {
  userId: "returning-owner",
  email: "owner@example.com",
  displayName: "Returning Owner",
  avatarUrl: null,
  userMetadata: { onboarding_intent_focus: "build" },
  orgProfile: null,
  orgSlug: null,
}

describe("onboarding defaults", () => {
  it("prefills the authenticated user's claimed username during recovery", async () => {
    const lookup = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { handle: "existing-owner" }, error: null }),
    }
    const from = vi.fn(() => ({ select: vi.fn(() => lookup) }))
    const defaults = await buildSavedOnboardingFlowDefaults({
      ...recoveryInput,
      needsOnboarding: true,
      supabase: { from } as never,
    })
    expect(defaults.defaultPersonHandle).toBe("existing-owner")
    expect(from).toHaveBeenCalledWith("public_handles")
    expect(lookup.eq).toHaveBeenCalledWith("owner_type", "person")
    expect(lookup.eq).toHaveBeenCalledWith("profile_id", "returning-owner")
  })

  it("fails a recovery identity read instead of offering an empty replacement username", async () => {
    const lookup = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: null,
          error: { message: "Lookup unavailable" },
        }),
    }
    await expect(
      buildSavedOnboardingFlowDefaults({
        ...recoveryInput,
        needsOnboarding: true,
        supabase: { from: () => ({ select: () => lookup }) } as never,
      })
    ).rejects.toThrow("Lookup unavailable")
  })

  it.each([
    { full_name: "Ada Lovelace", avatar_url: "https://example.com/google.jpg" },
    { name: "Ada Lovelace", picture: "https://example.com/google.jpg" },
    { given_name: "Ada", family_name: "Lovelace", picture: "https://example.com/google.jpg" },
  ])("prefills Google identity metadata without requiring a saved profile", (userMetadata) => {
    const defaults = buildOnboardingFlowDefaults({ ...recoveryInput, displayName: null, avatarUrl: null, userMetadata })
    expect(defaults).toMatchObject({ defaultFirstName: "Ada", defaultLastName: "Lovelace", defaultAvatarUrl: "https://example.com/google.jpg", defaultTitle: null })
  })

  it("prefers the saved profile name, photo and title over provider defaults", () => {
    expect(buildOnboardingFlowDefaults({ ...recoveryInput, displayName: "Saved Name", avatarUrl: "https://example.com/saved.jpg", profileTitle: "Executive Director", userMetadata: { name: "Google Name", picture: "https://example.com/google.jpg" } })).toMatchObject({ defaultFirstName: "Saved", defaultLastName: "Name", defaultAvatarUrl: "https://example.com/saved.jpg", defaultTitle: "Executive Director" })
  })

  it("derives workspace onboarding defaults from user metadata and org profile", () => {
    const defaults = buildOnboardingFlowDefaults({
      userId: "user-1",
      email: "owner@example.com",
      displayName: "Jordan Rivers",
      avatarUrl: "https://example.com/avatar.png",
      userMetadata: {
        onboarding_intent_focus: "build",
        onboarding_role_interest: "operator",
        marketing_opt_in: true,
        newsletter_opt_in: false,
      },
      orgProfile: {
        name: "Bright Futures Collective",
        formationStatus: "in_progress",
        email: "team@brightfutures.org",
        linkedin: "https://linkedin.com/company/bright-futures",
        org_people: [
          {
            id: "user-1",
            email: "owner@example.com",
            title: "Founder",
          },
        ],
      },
      orgSlug: "bright-futures",
    })

    expect(defaults.defaultOrgName).toBe("Bright Futures Collective")
    expect(defaults.defaultOrgSlug).toBe("bright-futures")
    expect(defaults.defaultFormationStatus).toBe("in_progress")
    expect(defaults.defaultIntentFocus).toBe("build")
    expect(defaults.defaultRoleInterest).toBe("operator")
    expect(defaults.defaultFirstName).toBe("Jordan")
    expect(defaults.defaultLastName).toBe("Rivers")
    expect(defaults.defaultPublicEmail).toBe("team@brightfutures.org")
    expect(defaults.defaultTitle).toBe("Founder")
    expect(defaults.defaultLinkedin).toBe(
      "https://linkedin.com/company/bright-futures"
    )
    expect(defaults.defaultAvatarUrl).toBe("https://example.com/avatar.png")
    expect(defaults.defaultOptInUpdates).toBe(true)
    expect(defaults.defaultNewsletterOptIn).toBe(false)
  })
})
