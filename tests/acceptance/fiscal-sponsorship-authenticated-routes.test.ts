import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import visualConfig from "../../playwright.visual.config"

// Inspect configuration without running platform-specific visual comparisons.
vi.mock("../../scripts/visual-baseline-environment", () => ({
  assertVisualBaselineEnvironment: vi.fn(),
}))

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const signPage = readSource(
  "src/app/(dashboard)/fiscal-sponsorship/sign/[packetId]/page.tsx"
)
const w9Page = readSource(
  "src/app/(dashboard)/fiscal-sponsorship/w9/[projectId]/page.tsx"
)
const browserConfig = readSource("playwright.fiscal-auth.config.ts")
const browserSpec = readSource(
  "tests/visual/fiscal-sponsorship-authenticated-routes.visual.spec.ts"
)
const nextConfig = readSource("next.config.ts")
const documentRoute = readSource(
  "src/app/api/fiscal-sponsorship/documents/[documentId]/route.ts"
)

describe("fiscal sponsorship authenticated route proof", () => {
  it("redirects signed-out users while preserving each return path", () => {
    for (const source of [signPage, w9Page]) {
      expect(source).toContain("resolveOptionalAuthenticatedAppContext")
      expect(source).toContain("if (!requestContext)")
      expect(source).toContain(
        "redirect(`/login?redirect=${encodeURIComponent(returnPath)}`)"
      )
    }
  })

  it("requires an isolated non-production Supabase branch", () => {
    expect(browserConfig).toContain("FISCAL_AUTH_QA_ALLOW_SEED")
    expect(browserConfig).toContain("PRODUCTION_SUPABASE_HOST")
    expect(browserConfig).toContain("reuseExistingServer: false")
    expect([visualConfig.testIgnore].flat()).toContain(
      "fiscal-sponsorship-authenticated-routes.visual.spec.ts"
    )
    expect(browserSpec).toContain("require a preview branch")
    expect(nextConfig).toContain('"vswzhuwjtgzrkxknrmxu.supabase.co"')
    expect(nextConfig).toContain("supabaseImageHosts.map")
  })

  it("covers applicant, assigned coach, operator, denied role, and PDF proof", () => {
    for (const evidence of [
      "signed-out visitors preserve",
      "applicant loads Form B",
      "assigned coach loads",
      "sponsor operator loads",
      "unassigned coach receives no signing session",
      'preview.headers()["x-document-sha256"]',
      "expectVerifiedDownload",
      "Document integrity verification failed.",
      "deniedDownload.status()).toBe(404)",
      "Complete IRS Form W-9",
    ]) {
      expect(browserSpec).toContain(evidence)
    }
  })

  it("rechecks staff assignment before privileged document storage access", () => {
    expect(documentRoute).toContain("canManageFiscalSponsorshipForOrganization")
    expect(documentRoute).toContain("organizationId: document.org_id")
    expect(documentRoute).toContain('error: "Document not found."')
    expect(
      documentRoute.indexOf("canManageFiscalSponsorshipForOrganization")
    ).toBeLessThan(documentRoute.indexOf(".download(document.storage_path)"))
  })
})
