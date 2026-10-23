import { describe, expect, it, vi } from "vitest"

import { renderMinimalEmail } from "@/lib/email/minimal-template"
import { buildOrganizationAccessEmailPreviews, buildOrganizationInviteEmailHtml } from "@/features/organization-access/client"

describe("minimal platform email", () => {
  it("escapes submitted content while preserving readable plain text and action destinations", () => {
    const email = renderMinimalEmail({
      title: '<img src=x onerror="bad()">',
      intro: "A & B",
      details: [{ label: "Applicant <name>", value: "Jordan\nLee" }],
      sections: [{ title: "The opportunity", body: ["<script>bad()</script>"], details: [{ label: "Goal", value: "$50,000" }] }],
      action: { label: "Review <application>", href: "https://coachhouse.app/projects/sample?tab=fiscal&view=review" },
      links: [{ label: "Calendar", href: "https://calendar.google.com/calendar/event?eid=sample" }],
      footer: "For the review team.",
    })
    expect(email.html).toContain('&lt;img src=x onerror=&quot;bad()&quot;&gt;')
    expect(email.html).toContain("&lt;script&gt;bad()&lt;/script&gt;")
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("tab=fiscal&amp;view=review")
    expect(email.text).toContain("Applicant <name>: Jordan\nLee")
    expect(email.text).toContain("Goal: $50,000")
    expect(email.text).toContain("https://coachhouse.app/projects/sample?tab=fiscal&view=review")
    expect(email.text).toContain("Calendar: https://calendar.google.com/calendar/event?eid=sample")
    expect(email.text).toContain("For the review team.")
  })

  it.each(["javascript:alert(1)", "data:text/html,test", "https://coachhouse.app/\nattack", "/projects/sample"])("rejects unsafe or nonabsolute action %s", (href) => {
    expect(() => renderMinimalEmail({ title: "Review", action: { label: "Open", href } })).toThrow("absolute HTTP(S)")
  })

  it("rejects unsafe secondary links and logo sources", () => {
    expect(() => renderMinimalEmail({ title: "Review", links: [{ label: "Open", href: "javascript:bad()" }] })).toThrow()
    expect(() => renderMinimalEmail({ title: "Review", logoUrl: "data:image/svg+xml,unsafe" })).toThrow()
  })

  it("uses the existing dark logo, responsive rows, and one uncluttered action", () => {
    const { html } = renderMinimalEmail({ title: "Application ready", action: { label: "Review application", href: "https://coachhouse.app/projects/sample" } })
    expect(html).toContain('src="https://coachhouse.app/coach-house-logo-dark.png"')
    expect(html).toContain('alt="Coach House" width="36" height="36"')
    expect(html).toContain("max-width:600px")
    expect(html).toContain(".email-label{width:38%!important")
    expect(html).toContain("background:#ffffff")
    expect(html).not.toContain("background:#f4f4f1")
    expect(html).not.toContain("border-radius:22px")
    expect(html.match(/<a /g)).toHaveLength(1)
  })

  it("renders long, missing, and multiline content without dropping its text equivalent", () => {
    const long = "Long project name ".repeat(100)
    const { html, text } = renderMinimalEmail({ title: long, sections: [{ title: "Summary", body: ["First line\nSecond line"] }] })
    expect(html).toContain("overflow-wrap:anywhere")
    expect(html).toContain("First line<br>Second line")
    expect(text).toContain(long)
    expect(text).toContain("First line\nSecond line")
    expect(html).not.toContain("undefined")
    expect(html).not.toContain('<a href="')
  })

  it("provides matching HTML and text for all organization/auth previews without verification claims", () => {
    const previews = buildOrganizationAccessEmailPreviews("https://coachhouse.app")
    expect(previews).toHaveLength(8)
    for (const preview of previews) {
      expect(preview.html).toContain("coach-house-logo-dark.png")
      expect(preview.text).toContain("Coach House")
      expect(preview.text).not.toContain("Security: Verified")
      expect(preview.html).not.toContain("paste this link")
    }
    const confirmation = previews.find((preview) => preview.id === "supabase-confirm-sign-up")!
    expect(confirmation.html).toContain("token_hash={{ .TokenHash }}&amp;type=email&amp;next={{ .RedirectTo }}")
    expect(confirmation.text).toContain("token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}")
    const recovery = previews.find((preview) => preview.id === "supabase-reset-password")!
    expect(recovery.html).toContain("token_hash={{ .TokenHash }}&amp;type=recovery&amp;next={{ .RedirectTo }}")
    expect(recovery.text).toContain("Reset password: https://coachhouse.app/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}")
    expect(recovery.text).toContain("If you didn’t request a password reset")
  })

  it("keeps invitation role and secure join destination intact", () => {
    const html = buildOrganizationInviteEmailHtml({ siteUrl: "https://coachhouse.app", organizationName: "Northside <Team>", role: "member", joinUrl: "https://coachhouse.app/join-organization?token=sample&flow=invite" })
    expect(html).toContain("Northside &lt;Team&gt;")
    expect(html).toContain("token=sample&amp;flow=invite")
    expect(html).toContain("Role")
  })
})

const sendResendEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, id: "sample-delivery" }))
vi.mock("@/lib/email/resend", () => ({ sendResendEmail }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))

describe("organization email delivery", () => {
  it.each(["external", "existing"] as const)("sends matching %s content with original recipient, destination and review deadline", async (kind) => {
    const { sendExistingUserAccessRequestEmail, sendExternalOrganizationInviteEmail } = await import("@/app/actions/organization-access/invites-side-effects")
    const input = {
      to: "sample@example.test",
      siteUrl: "https://coachhouse.app",
      organizationName: "Northside <Team>",
      inviterName: "Jordan <Lee>",
      role: "staff" as const,
      expiresAt: "2026-10-23T12:00:00Z",
    }
    const url = "https://coachhouse.app/join-organization?token=sample&flow=invite"
    if (kind === "external") await sendExternalOrganizationInviteEmail({ ...input, inviteUrl: url })
    else await sendExistingUserAccessRequestEmail({ ...input, reviewUrl: url })
    const sent = sendResendEmail.mock.calls.at(-1)![0]
    expect(sent.to).toBe(input.to)
    expect(sent.text).toContain("Jordan <Lee>")
    expect(sent.html).toContain("Jordan &lt;Lee&gt;")
    expect(sent.text).toContain("Role: Staff")
    expect(sent.html).toContain("Staff")
    expect(sent.text).toContain("Respond by: October 23, 2026")
    expect(sent.html).toContain("October 23, 2026")
    expect(sent.text).toContain(url)
    expect(sent.html).toContain(url.replaceAll("&", "&amp;"))
    expect(sent.tags).toContainEqual({ name: "category", value: kind === "external" ? "organization-invite" : "organization-access-request" })
    expect(sent.html).toContain("coach-house-logo-dark.png")
  })
})
