import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { validateOnboardingStep } from "@/components/onboarding/onboarding-dialog/state-helpers"
import { ProfileBasicsStep } from "@/components/onboarding/onboarding-dialog/components/profile-basics-step"
import { IntentStep } from "@/components/onboarding/onboarding-dialog/components/intent-step"
import { OrganizationStep } from "@/components/onboarding/onboarding-dialog/components/organization-step"

describe("onboarding organization step", () => {
  it("renders formation status choices as card-style toggles instead of grouped button chrome", () => {
    const markup = renderToStaticMarkup(
      createElement(OrganizationStep, {
        step: 1,
        attemptedStep: null,
        errors: {},
        initialOrgName: "",
        initialOrgSlug: "",
        slugStatus: "idle",
        slugHint: null,
        formationStatus: "approved",
        onOrgNameChange: () => undefined,
        onOrgSlugChange: (value: string) => value,
        onFormationStatusSelect: () => undefined,
      }),
    )

    expect(markup).toContain(
      "box-border grid w-full max-w-full min-w-0 items-stretch gap-2 sm:grid-cols-3",
    )
    expect(markup).toContain(
      "flex h-full w-full min-w-0 items-stretch justify-start rounded-2xl border p-0 text-left whitespace-normal shadow-none transition-colors outline-none",
    )
    expect(markup).toContain(
      "flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl p-3 text-left",
    )
    expect(markup).not.toContain("w-fit items-center")
    expect(markup).not.toContain("whitespace-nowrap")
  })
})


describe("compact signup basics", () => {
  it("offers a labeled intent selector instead of four cards", () => {
    const markup = renderToStaticMarkup(createElement(IntentStep, {
      step: 0, attemptedStep: null, errors: {}, intentFocus: "build", onSelectIntent: () => undefined,
    }))
    expect(markup).toContain('role="combobox"')
    expect(markup).toContain('data-onboarding-primary-focus="true"')
    expect(markup).not.toContain('aria-pressed')
  })

  it("shows editable saved organization values and a compact formation selector", () => {
    const markup = renderToStaticMarkup(createElement(OrganizationStep, {
      compact: true, step: 0, attemptedStep: null, errors: {},
      initialOrgName: "Community Table", initialOrgSlug: "community-table",
      slugStatus: "available", slugHint: null, formationStatus: "approved",
      onOrgNameChange: () => undefined, onOrgSlugChange: (value: string) => value,
      onFormationStatusSelect: () => undefined,
    }))
    expect(markup).toContain('value="Community Table"')
    expect(markup).toContain('value="community-table"')
    expect(markup).toContain('role="combobox"')
    expect(markup).not.toContain('data-slot="toggle-group"')
  })

  it("requires a username while keeping other compact profile details optional", () => {
    const values = { firstName: "", lastName: "", personHandle: "", phone: "", publicEmail: "", title: "", linkedin: "", optInUpdates: false, newsletterOptIn: false }
    const markup = renderToStaticMarkup(createElement(ProfileBasicsStep, { values, personHandleStatus: "idle", personHandleHint: null, avatarPreview: null, avatarInputRef: { current: null }, submitting: false, onRemoveAvatar: () => undefined }))
    expect(markup).toContain('autoComplete="name"')
    expect(markup).toContain('aria-label="Upload profile photo"')
    expect(markup).toContain('name="title"')
    expect(markup).toContain('autoComplete="username"')
    expect(markup).toMatch(/id="personHandle"[^>]*required=""/)
    expect(markup).not.toContain('name="newsletterOptIn"')
    const form = new FormData()
    form.set("onboardingMode", "post_signup_access")
    form.set("onboardingVersion", "workspace_profile")
    const input = { stepId: "account" as const, form, intentFocus: "build" as const, formationStatus: "" as const, slugStatus: "available" as const, slugHint: null, personHandleStatus: "idle" as const, personHandleHint: null, builderPlanTier: "free" as const }
    expect(validateOnboardingStep(input)).toHaveProperty("personHandle", "Username is required")
    form.set("personHandle", "ada-lovelace")
    expect(validateOnboardingStep({ ...input, personHandleStatus: "checking" })).toHaveProperty("personHandle")
    expect(validateOnboardingStep({ ...input, personHandleStatus: "unavailable", personHandleHint: "Already taken" })).toHaveProperty("personHandle", "Already taken")
    expect(validateOnboardingStep({ ...input, personHandleStatus: "available" })).toEqual({})
    form.set("intentFocus", "build")
    form.set("orgName", "Community Table")
    form.set("orgSlug", "community-table")
    expect(validateOnboardingStep({ ...input, stepId: "intent" })).toEqual({})
  })

  it.each([
    ["checking", null, "Checking availability…"],
    ["available", null, "Username available"],
    ["unavailable", "That username is already taken.", "That username is already taken."],
  ] as const)("announces username availability: %s", (personHandleStatus, personHandleHint, text) => {
    const values = { firstName: "Ada", lastName: "", personHandle: "ada", phone: "", publicEmail: "", title: "", linkedin: "", optInUpdates: false, newsletterOptIn: false }
    const markup = renderToStaticMarkup(createElement(ProfileBasicsStep, { values, personHandleStatus, personHandleHint, avatarPreview: null, avatarInputRef: { current: null }, submitting: false, onRemoveAvatar: () => undefined }))
    expect(markup).toContain(text)
    expect(markup).toContain('aria-describedby="profile-username-status"')
    expect(markup).toContain('aria-live="polite"')
  })

  it("validates organization basics on the first builder step but not member intent", () => {
    const form = new FormData()
    form.set("onboardingMode", "post_signup_access")
    form.set("intentFocus", "build")
    const input = {
      stepId: "intent" as const, form, intentFocus: "build" as const,
      formationStatus: "" as const, slugStatus: "idle" as const, slugHint: null,
      personHandleStatus: "idle" as const, personHandleHint: null, builderPlanTier: "free" as const,
    }
    expect(validateOnboardingStep(input)).toHaveProperty("orgName")
    expect(validateOnboardingStep(input)).toHaveProperty("orgSlug")
    expect(validateOnboardingStep(input)).toHaveProperty("formationStatus")
    form.set("orgName", "Community Table")
    form.set("orgSlug", "community-table")
    expect(validateOnboardingStep({ ...input, formationStatus: "approved", slugStatus: "available" })).toEqual({})
    expect(validateOnboardingStep({ ...input, formationStatus: "approved", slugStatus: "unavailable" })).toHaveProperty("orgSlug")
    form.set("intentFocus", "find")
    expect(validateOnboardingStep({ ...input, intentFocus: "find" })).toEqual({})
  })
})
