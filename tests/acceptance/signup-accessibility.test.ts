import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("signup accessibility affordances", () => {
  it("keeps auth form secondary actions reachable at browser zoom", () => {
    const loginSource = readSource("src/components/auth/login-form.tsx")
    const signUpSource = readSource("src/components/auth/sign-up-form.tsx")
    const passwordInputSource = readSource(
      "src/components/auth/password-input.tsx"
    )
    const homeCanvasBehaviorSource = readSource(
      "src/components/public/home-canvas-behavior.ts"
    )

    expect(loginSource).toContain("flex flex-wrap justify-between")
    expect(loginSource).toContain("focus-visible:ring-2")
    expect(signUpSource).toContain(
      'role={status === "error" ? "alert" : "status"}'
    )
    expect(signUpSource).toContain("aria-busy={isPending || undefined}")
    expect(passwordInputSource).toContain('className={cn("pr-11", className)}')
    expect(passwordInputSource).toContain("size-9")
    expect(passwordInputSource).toContain("aria-pressed={visible}")
    expect(homeCanvasBehaviorSource).toContain('sectionId === "pricing"')
    expect(homeCanvasBehaviorSource).toContain('sectionId === "accelerator"')
    expect(homeCanvasBehaviorSource).not.toContain('sectionId === "signup"')
    expect(homeCanvasBehaviorSource).not.toContain('sectionId === "login"')
  })

  it("exposes onboarding visual states to assistive technology", () => {
    const intentSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/intent-step.tsx"
    )
    const organizationSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/organization-step.tsx"
    )
    const accountSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/account-step.tsx"
    )
    const contentSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/onboarding-dialog-content.tsx"
    )

    expect(intentSource).toContain('<FieldLabel htmlFor={id}>')
    expect(intentSource).toContain("aria-invalid={showError}")
    expect(intentSource).toContain("aria-describedby={showError ? errorId : undefined}")
    expect(intentSource).toContain('role="alert"')
    expect(organizationSource).toContain("aria-describedby={")
    expect(organizationSource).toContain('role="status"')
    expect(organizationSource).toContain('role="alert"')
    expect(accountSource).toContain("after:-inset-2")
    expect(accountSource).toContain("aria-describedby={avatarHintId}")
    expect(contentSource).toContain('role="alert"')
  })

  it("lets pricing and onboarding action buttons wrap instead of clipping", () => {
    const publicPricingSource = readSource(
      "src/components/public/pricing-surface-sections/pricing-tier-cards-section.tsx"
    )
    const onboardingPricingSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/pricing-step.tsx"
    )
    const footerSource = readSource(
      "src/components/onboarding/onboarding-dialog/components/step-footer.tsx"
    )
    const atlasOutlineSource = readSource(
      "src/features/user-journey-atlas/components/user-journey-atlas-outline.tsx"
    )

    expect(publicPricingSource).toContain("whitespace-normal")
    expect(publicPricingSource).toContain("flex flex-wrap")
    expect(onboardingPricingSource).toContain("whitespace-normal")
    expect(onboardingPricingSource).toContain("aria-current={")
    expect(footerSource).toContain("min-h-9")
    expect(footerSource).toContain("whitespace-normal")
    expect(atlasOutlineSource).toContain('role="group"')
    expect(atlasOutlineSource).toContain(
      "aria-label={`${data.title}: ${data.subtitle}`}"
    )
  })
})
