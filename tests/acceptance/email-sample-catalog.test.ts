import { describe, expect, it } from "vitest"
import { buildEmailSampleCatalog, EMAIL_SAMPLE_EXCEPTIONS, inertEmailSample } from "@/lib/email/sample-suite-catalog"
import { auditEmailContentForDelivery } from "@/lib/email/content-audit"

describe("platform email sample catalog", () => {
  it("covers active app/auth families, meaningful fiscal states and three drafts", () => {
    const samples = buildEmailSampleCatalog()
    expect(samples).toHaveLength(35)
    expect(new Set(samples.map(({ id }) => id)).size).toBe(samples.length)
    expect(samples.filter(({ category }) => category === "supabase-auth")).toHaveLength(6)
    expect(samples.filter(({ category }) => category === "coaching")).toHaveLength(2)
    expect(samples.filter(({ category }) => category === "campaign draft")).toHaveLength(3)
    expect(samples.map(({ id }) => id)).toEqual(expect.arrayContaining(["fs-reviewer-new", "fs-reviewer-corrections", "fs-applicant-application-needs-info", "fs-applicant-application-approved", "fs-applicant-application-declined", "fs-signature-request", "fs-staff-agreement-completed", "fs-staff-w9-completed"]))
    expect(EMAIL_SAMPLE_EXCEPTIONS.map(({ provider }) => provider)).toEqual(expect.arrayContaining(["Supabase Auth", "Google Calendar", "Stripe", "DocuSeal"]))
  })

  it("keeps every action inert, removes provider placeholders and preserves the real logo", () => {
    for (const sample of buildEmailSampleCatalog()) {
      expect(sample.html).not.toContain("{{")
      expect(sample.text).not.toContain("{{")
      const links = [...sample.html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1])
      expect(links.every((href) => href === `https://example.com/coach-house-email-preview/${sample.id}`)).toBe(true)
      expect(sample.html).toMatch(/<img\b[^>]*alt="Coach House"/)
      expect(sample.text.trim().length).toBeGreaterThan(20)
      expect([...sample.text.matchAll(/https?:\/\/[^\s<>]+/g)].every(([url]) => url.startsWith("https://example.com/coach-house-email-preview/"))).toBe(true)
    }
  })

  it("uses exact requested FS subjects and fictional application details", () => {
    const samples = buildEmailSampleCatalog()
    expect(samples.find(({ id }) => id === "fs-reviewer-new")?.subject).toBe("New FS application: Neighborhood Learning Collective")
    expect(samples.find(({ id }) => id === "fs-reviewer-corrections")?.subject).toBe("FS corrections received: Neighborhood Learning Collective")
    expect(samples.find(({ id }) => id === "fs-applicant-receipt")?.text).toContain("Alex")
    expect(samples.find(({ id }) => id === "fs-reviewer-new")?.text).toContain("$75,000")
  })

  it("replaces embedded auth placeholders and mail links without changing images", () => {
    const result = inertEmailSample({ id: "security-check", category: "auth", state: "sample", source: "fixture", subject: "Secure action", html: '<a href="{{ .ConfirmationURL }}">Verify</a><a href="mailto:staff@example.com">Contact</a><img src="https://coachhouse.app/logo.png" alt="Coach House">', text: "Code {{ .Token }} / https://coachhouse.app/auth/confirm?token=example" })
    expect(result.html).toContain('src="https://coachhouse.app/logo.png"')
    expect(result.html).not.toContain("mailto:")
    expect(result.text).toContain("SAMPLE-NOT-A-TOKEN")
    expect(result.text).not.toContain("token=example")
  })

  it("passes the same content audit used by real delivery", () => {
    for (const sample of buildEmailSampleCatalog()) {
      const result = auditEmailContentForDelivery(sample)
      expect(result.issues.filter(({ severity }) => severity === "blocked"), sample.id).toEqual([])
      expect(result.sanitizedHtml).toContain("Coach House")
    }
  })
})
