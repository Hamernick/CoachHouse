import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  phase: "submitted", reference: "a1f8d808-b489-4bf4-bcac-e94f711c7a82",
}))
vi.mock("@/features/fiscal-sponsorship/client", async () => import("@/features/fiscal-sponsorship/lib/public-routes"))
vi.mock("@/features/fiscal-sponsorship/components/use-public-fiscal-draft", () => ({ usePublicFiscalDraft: () => ({
  state: { phase: mock.phase, reference: mock.reference, dirty: false, draft: {} }, controller: {},
}) }))
vi.mock("@/features/fiscal-sponsorship/components/use-public-fiscal-submission", () => ({ usePublicFiscalSubmission: () => ({ errors: {}, working: false, uncertain: false, message: "" }) }))
vi.mock("@/features/fiscal-sponsorship/components/use-public-fiscal-navigation", () => ({ usePublicFiscalNavigation: () => ({ destination: null }) }))
vi.mock("@/features/fiscal-sponsorship/components/fiscal-public-draft-status", () => ({ FiscalPublicDraftStatus: () => null, FiscalPublicLeaveDialog: () => null }))
vi.mock("@/features/fiscal-sponsorship/components/fiscal-sponsorship-application-editor-fields", () => ({ FiscalSponsorshipApplicationEditorFields: () => null }))

import { GET, HEAD } from "@/app/(public)/fs/route"
import { FiscalSponsorshipPublicIntake } from "@/features/fiscal-sponsorship/components/fiscal-sponsorship-public-intake"

describe("public fiscal application entry and receipt", () => {
  it.each([GET, HEAD])("redirects GET and HEAD to the fixed destination with repeated query values", (handler) => {
    const response = handler(new Request("http://localhost:3127/fs?utm_source=email&tag=one&tag=two&redirect=https%3A%2F%2Fother.test"))
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe("http://localhost:3127/documentation/fiscal-sponsorship?utm_source=email&tag=one&tag=two&redirect=https%3A%2F%2Fother.test")
  })
  it("redirects the bare short link without an empty query", () => {
    expect(GET(new Request("https://coachhouse.app/fs")).headers.get("location")).toBe("https://coachhouse.app/documentation/fiscal-sponsorship")
  })
  it("keeps the receipt and application reference with one optional account action", () => {
    mock.phase = "submitted"
    const html = renderToStaticMarkup(React.createElement(FiscalSponsorshipPublicIntake, { profileImportEnabled: true }))
    expect(html).toContain("Application received")
    expect(html).toContain(mock.reference)
    expect(html).toContain(`href="/documentation/fiscal-sponsorship/profile?application=${mock.reference}"`)
    expect(html).toContain("Start free and save your info")
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).not.toContain("Check status")
    expect(html).not.toContain("Not now")
  })
  it("keeps a completed receipt when optional profile import is disabled", () => {
    mock.phase = "submitted"
    const html = renderToStaticMarkup(React.createElement(FiscalSponsorshipPublicIntake))
    expect(html).toContain("Application received")
    expect(html).not.toContain("<a ")
  })
  it("removes only requested secondary copy while retaining application guidance and submit", () => {
    mock.phase = "ready"
    const html = renderToStaticMarkup(React.createElement(FiscalSponsorshipPublicIntake, { submissionEnabled: true, profileImportEnabled: true }))
    expect(html).not.toContain("No payment or account needed to apply.")
    expect(html).not.toContain("After submitting, you’ll have the option")
    expect(html).toContain("Tell us about you and your project. No account required.")
    expect(html).toContain("Submit application")
    expect(html).toContain('aria-describedby="application-preview-note"')
  })
})
