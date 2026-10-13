import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("sign up form flow", () => {
  it("keeps the onboarding-path question out of the pre-confirmation form", () => {
    const source = readSource("src/components/auth/sign-up-form.tsx")

    expect(source).not.toContain("How will you use Coach House?")
    expect(source).not.toContain("JOURNEY_OPTIONS")
    expect(source).not.toContain("Builder accounts continue into pricing")
    expect(source).toContain(
      "const activeIntentFocus = lockedIntentFocus ?? defaultIntentFocus",
    )
  })
})

describe("embedded collection signup", () => {
  it("keeps confirmation in-frame while preserving consent and the normal standalone flow", () => {
    const source = readSource("src/components/auth/sign-up-form.tsx")
    expect(source).toContain('if (status !== "success" || onAuthenticated) return')
    expect(source).toContain("data.session && onAuthenticated")
    expect(source).toContain("legal_consent: legalConsent")
    expect(source).toContain("router.replace(resolvedLoginHref)")
    expect(source).toContain("redirectOnSuccess={!onAuthenticated}")
  })
})
