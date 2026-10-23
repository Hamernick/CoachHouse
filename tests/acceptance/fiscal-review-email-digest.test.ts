import { describe, expect, it } from "vitest"
import { reviewerEmailDigest } from "@/features/fiscal-sponsorship/lib/reviewer-email-digest"
const url = "https://coachhouse.app/projects/10000000-0000-4000-8000-000000000002"
const snapshot = { project_name: "Neighborhood Garden", applicant_full_name: "Sam River", primary_email: "sam@example.test", project_description: "Grow food together.", public_benefit: "Fresh food for neighbors.", fundraising_goal: { amountCents: 1250000, period: "annually" }, received_at: "2026-10-16T20:00:00Z", operates_outside_united_states: false, engages_in_lobbying: true, legal_entity_type: "llc" }
describe("fiscal application digest", () => {
 it("renders an actionable overview with truthful applicant-reported details and matching plain text", () => {
  const result = reviewerEmailDigest(snapshot, url)
  expect(result.subject).toBe("New FS application: Neighborhood Garden")
  for (const content of [result.html, result.text]) {
   for (const text of ["Sam River", "$12,500 / year", "Ready for review", "Fresh food for neighbors.", "LLC", "UTC", "Not provided", "Review application"]) expect(content).toContain(text)
   expect(content).toContain(url)
   expect(content).not.toContain("#verify=")
  }
  expect(result.html).toContain('lang="en"')
  expect(result.html).toContain("max-width:480px")
 })
 it("escapes arbitrary applicant HTML and omits tokens, internal notes and unselected fields", () => {
  const result = reviewerEmailDigest({ ...snapshot, project_name: '<img src=x onerror="alert(1)">', project_description: "<script>unsafe()</script>", review_notes: "PRIVATE-NOTE", token: "SECRET-TOKEN", mailing_street_address: "PRIVATE-STREET" }, url)
  expect(result.html).toContain("&lt;script&gt;")
  expect(result.html).not.toContain("<script>")
  expect(result.html).not.toContain("<img src=x")
  expect(result.html.match(/<img /g)).toHaveLength(1)
  for (const content of [result.text, result.html]) for (const privateText of ["PRIVATE-NOTE", "SECRET-TOKEN", "PRIVATE-STREET"]) expect(content).not.toContain(privateText)
 })
 it("labels corrections without inventing a change comparison and preserves a stable payload", () => {
  const result = reviewerEmailDigest(snapshot, url, true)
  expect(result.subject).toBe("FS corrections received: Neighborhood Garden")
  expect(result.text).toContain("requested corrections")
  expect(reviewerEmailDigest(snapshot, url, true)).toEqual(result)
 })
 it("bounds long narratives while preserving complete answers behind the review link", () => {
  const result = reviewerEmailDigest({ ...snapshot, project_description: "a".repeat(6000) }, url)
  expect(result.text).toContain("a".repeat(479) + "…")
  expect(result.text).toContain("Longer answers are shortened here")
  expect(result.html.length).toBeLessThan(20000)
 })
 it("does not turn unknown answers into negative declarations or fabricate a funding period", () => {
  const result = reviewerEmailDigest({ project_name: "Old application", estimated_budget_cents: 300000 }, url)
  expect(result.text).toContain("Fundraising goal: $3,000")
  expect(result.text).not.toContain(" / year")
  expect(result.text).toContain("Lobbying activities: Not provided")
 })
})
