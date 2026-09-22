import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  createSignupLegalConsent,
  isCurrentSignupLegalConsent,
  PRIVACY_DOCUMENT,
  TERMS_DOCUMENT,
} from "@/features/legal-consent"
import { signUpSchema } from "@/components/auth/sign-up-form-schema"

function contentHash(document: typeof TERMS_DOCUMENT) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slug: document.slug,
        title: document.title,
        description: document.description,
        effectiveDate: document.effectiveDate,
        version: document.version,
        sections: document.sections,
      })
    )
    .digest("hex")
}

describe("legal consent", () => {
  it("requires explicit acceptance during signup", () => {
    const rejected = signUpSchema.safeParse({
      email: "member@example.test",
      password: "password123",
      confirmPassword: "password123",
      acceptedLegal: false,
    })
    expect(rejected.success).toBe(false)

    expect(
      signUpSchema.safeParse({
        email: "member@example.test",
        password: "password123",
        confirmPassword: "password123",
        acceptedLegal: true,
      }).success
    ).toBe(true)
  })

  it("binds acceptance to the exact document content", () => {
    expect(TERMS_DOCUMENT.sha256).toBe(contentHash(TERMS_DOCUMENT))
    expect(PRIVACY_DOCUMENT.sha256).toBe(contentHash(PRIVACY_DOCUMENT))
    expect(createSignupLegalConsent(new Date("2026-08-11T20:00:00Z"))).toEqual({
      version: TERMS_DOCUMENT.version,
      termsSha256: TERMS_DOCUMENT.sha256,
      privacySha256: PRIVACY_DOCUMENT.sha256,
      acceptedAt: "2026-08-11T20:00:00.000Z",
    })
    expect(
      isCurrentSignupLegalConsent({
        ...createSignupLegalConsent(),
        termsSha256: "0".repeat(64),
      })
    ).toBe(false)
  })

  it("discloses material data practices and service limitations", () => {
    const privacyText = JSON.stringify(PRIVACY_DOCUMENT)
    const termsText = JSON.stringify(TERMS_DOCUMENT)

    for (const disclosure of [
      "Stripe",
      "Supabase",
      "Vercel",
      "Mapbox",
      "Resend",
      "hCaptcha",
      "OpenAI",
      "financial",
      "location",
      "retention",
      "Google Drive",
      "Google Calendar",
    ]) {
      expect(privacyText).toContain(disclosure)
    }

    expect(termsText).toContain(
      "Marketing consent is not a condition of purchase"
    )
    expect(termsText).toContain("Resource listings")
    expect(termsText).toContain("protected health information")
    expect(termsText).toContain("Limitation of liability")
  })

  it("owns canonical routes and links every signup surface", () => {
    const privacyPage = readFileSync(
      "src/app/(public)/privacy/page.tsx",
      "utf8"
    )
    const termsPage = readFileSync("src/app/(public)/terms/page.tsx", "utf8")
    const signUpForm = readFileSync(
      "src/components/auth/sign-up-form.tsx",
      "utf8"
    )
    const legalDocumentPage = readFileSync(
      "src/features/legal-consent/components/legal-document-page.tsx",
      "utf8"
    )
    const consentPanel = readFileSync(
      "src/features/legal-consent/components/legal-consent-panel.tsx",
      "utf8"
    )
    expect(privacyPage).toContain("PRIVACY_DOCUMENT")
    expect(privacyPage).toContain('canonical: "/privacy"')
    expect(termsPage).toContain("TERMS_DOCUMENT")
    expect(termsPage).toContain('canonical: "/terms"')
    expect(legalDocumentPage).toContain('data-legal-document-canvas=""')
    expect(legalDocumentPage).toContain("rounded-[28px]")
    expect(legalDocumentPage).not.toContain("bg-[#07111f]")
    expect(legalDocumentPage).not.toContain("radial-gradient")
    expect(legalDocumentPage).not.toContain("PublicHeader")
    expect(legalDocumentPage).not.toContain("PublicThemeToggle")
    expect(signUpForm).toContain("LegalConsentField")
    expect(consentPanel).toContain('href="/terms"')
    expect(consentPanel).toContain('href="/privacy"')
  })

  it("stores immutable user-linked acceptance with own-row read access", () => {
    const migration = readFileSync(
      "supabase/migrations/20260811160000_add_signup_legal_acceptances.sql",
      "utf8"
    )
    const currentConsentMigration = readFileSync(
      "supabase/migrations/20260910120000_accept_drive_privacy_consent.sql",
      "utf8"
    )
    expect(migration).toContain("references auth.users(id) on delete cascade")
    expect(migration).toContain("unique (user_id, document_version)")
    expect(migration).toContain(
      "alter table public.platform_legal_acceptances enable row level security"
    )
    expect(migration).toContain(
      "revoke all on public.platform_legal_acceptances from anon, authenticated"
    )
    expect(migration).toContain("using ((select auth.uid()) = user_id)")
    expect(migration).toContain("after insert on auth.users")
    expect(currentConsentMigration).toContain(
      `consent ->> 'version' = '${TERMS_DOCUMENT.version}'`
    )
    expect(currentConsentMigration).toContain(
      `consent ->> 'termsSha256' = '${TERMS_DOCUMENT.sha256}'`
    )
    expect(currentConsentMigration).toContain(
      `consent ->> 'privacySha256' = '${PRIVACY_DOCUMENT.sha256}'`
    )
    expect(currentConsentMigration).toContain(
      "consent ->> 'version' = '2026-08-12.1'"
    )
    expect(currentConsentMigration).toContain(
      "consent ->> 'version' = '2026-09-09.1'"
    )

    const rlsSuite = readFileSync("supabase/tests/rls.test.mjs", "utf8")
    expect(rlsSuite).toContain(
      "signup trigger records the current immutable legal acceptance"
    )
    expect(rlsSuite).toContain(
      "authenticated users cannot mutate immutable legal acceptances"
    )
    expect(rlsSuite).toContain("anonymous users cannot read legal acceptances")

    const testerAction = readFileSync(
      "src/app/(auth)/tester/sign-up/actions.ts",
      "utf8"
    )
    expect(testerAction).toContain("Tester account provisioning is unavailable")
    expect(testerAction).not.toContain("createSupabaseAdminClient")
    expect(testerAction).not.toContain("email_confirm")
  })

  it("rejects public signup without current server-validated consent", () => {
    const migration = readFileSync(
      "supabase/migrations/20260910120000_accept_drive_privacy_consent.sql",
      "utf8"
    )
    expect(migration).toContain(
      "raise exception 'Current Terms and Privacy Policy acceptance is required.'"
    )
    expect(migration).toContain("new.raw_app_meta_data")
    expect(migration).toContain("legal_consent_exempt' = 'service_provisioned'")
    expect(migration).not.toContain(
      "new.raw_user_meta_data ->> 'legal_consent_exempt'"
    )
    expect(migration).toContain("coalesce(new.created_at, now())")
  })

  it("provisions every live RLS fixture with current consent, not an exemption", () => {
    const rlsSuite = readFileSync("supabase/tests/rls.test.mjs", "utf8")
    const registrations = [
      ...rlsSuite.matchAll(/auth\.admin\.createUser\(\{([\s\S]*?)\n  \}\)/g),
    ]

    expect(registrations).toHaveLength(8)
    for (const [, payload] of registrations) {
      expect(payload).toContain("user_metadata: { legal_consent: signupLegalConsent }")
      expect(payload).not.toContain("app_metadata")
    }
    expect(rlsSuite).toContain(`version: "${TERMS_DOCUMENT.version}"`)
    expect(rlsSuite).toContain(TERMS_DOCUMENT.sha256)
    expect(rlsSuite).toContain(PRIVACY_DOCUMENT.sha256)
    expect(rlsSuite).not.toContain("legal_consent_exempt")
  })
})
