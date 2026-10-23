import { beforeEach, describe, expect, it, vi } from "vitest"
import { auditEmailContentForDelivery } from "@/lib/email/content-audit"
import { buildCoachingBookingEmail } from "@/features/coaching-booking/client"
import { buildFiscalSignatureEmail } from "@/features/fiscal-sponsorship/lib/signature-email"
import { buildEmailOpsCampaignEmail, emailOpsSampleCampaignIds, findEmailOpsCampaign } from "@/features/email-ops/client"

const send = vi.hoisted(() => vi.fn(async (_input: Record<string, unknown>) => ({ ok: true, id: "test-provider-id" })))
vi.mock("@/lib/email/resend", () => ({ sendResendEmail: send, canSendResendEmail: () => true }))
import { sendCoachingBookingConfirmationEmails } from "@/features/coaching-booking/server/email"

const booking = {
  siteUrl: "https://coachhouse.app",
  attendeeEmail: "applicant@example.org",
  startsAt: "2026-10-20T18:00:00Z",
  endsAt: "2026-10-20T18:45:00Z",
  timezone: "America/Chicago",
  googleEventHtmlLink: "https://calendar.google.com/calendar/event?eid=fixture",
  googleMeetUrl: "https://meet.google.com/abc-defg-hij",
  attendeeNotes: "Discuss <funding> & next steps",
}

describe("minimal platform email families", () => {
  beforeEach(() => send.mockClear())

  it.each(["attendee", "coach"] as const)("renders %s booking details, all actions and escaped notes", (audience) => {
    const email = buildCoachingBookingEmail({ ...booking, audience })
    expect(auditEmailContentForDelivery(email).blocked).toBe(false)
    expect(email.html).toContain('alt="Coach House"')
    expect(email.html).toContain("Discuss &lt;funding&gt; &amp; next steps")
    expect(email.text).toContain("Tuesday, October 20, 2026, 1:00 PM CDT to 1:45 PM CDT")
    expect(email.text).toContain("America/Chicago")
    for (const url of [booking.googleEventHtmlLink, booking.googleMeetUrl, "https://coachhouse.app/coaching"]) {
      expect(email.html).toContain(url)
      expect(email.text).toContain(url)
    }
    expect(email.text.includes("Attendee: applicant@example.org")).toBe(audience === "coach")
  })

  it("omits untrusted calendar/meeting links and empty notes", () => {
    const email = buildCoachingBookingEmail({ ...booking, audience: "attendee", attendeeNotes: " ", googleEventHtmlLink: "https://evil.example/calendar/event", googleMeetUrl: "javascript:alert(1)" })
    expect(email.html).not.toContain("evil.example")
    expect(email.html).not.toContain("javascript:")
    expect(email.text).not.toContain("Notes")
    expect(email.html).toContain("https://coachhouse.app/coaching")
  })

  it("keeps coach and attendee send destinations and categories separate", async () => {
    await sendCoachingBookingConfirmationEmails({ ...booking, coachEmails: ["joel@example.org", "Joel@example.org", "paula@example.org"], bookingId: "booking-fixture" })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0]).toMatchObject({ to: ["applicant@example.org"], subject: "Your Coach House coaching meeting is confirmed", tags: [{ name: "category", value: "coaching-booking-confirmed" }, { name: "booking", value: "booking-fixture" }] })
    expect(send.mock.calls[1][0]).toMatchObject({ to: ["joel@example.org", "paula@example.org"], subject: "New Coach House coaching meeting booked" })
    expect(send.mock.calls[0][0]).not.toHaveProperty("cc")
  })

  it("renders the assigned-account signature action without exposing a provider token", () => {
    const email = buildFiscalSignatureEmail({ siteUrl: "https://coachhouse.app", projectName: "Food <Together>\r\nProgram", signingUrl: "https://coachhouse.app/fiscal-sponsorship/sign/sample-packet" })
    expect(email.subject).toBe("Food <Together> Program is ready for signature")
    expect(email.html).toContain("Food &lt;Together&gt;")
    expect(email.text).toContain("Sign in with the Coach House account assigned to this application.")
    expect(email.html).toContain('href="https://coachhouse.app/fiscal-sponsorship/sign/sample-packet"')
    expect(email.html).toContain('alt="Coach House"')
  })

  it.each(emailOpsSampleCampaignIds)("retains authored %s campaign content with one minimal logo", (id) => {
    const campaign = findEmailOpsCampaign(id)!
    const email = buildEmailOpsCampaignEmail(campaign)
    expect(auditEmailContentForDelivery(email).blocked).toBe(false)
    expect(email.subject).toBe(campaign.subject)
    expect(email.html.match(/alt="Coach House"/g)).toHaveLength(1)
    expect(email.html).not.toContain("border-radius:24px")
    expect(email.html).not.toContain("border:1px dashed")
    if (id === "weekly-product-update") {
      expect(email.html).toContain("Asset block / fiscal sponsorship flow")
      expect(email.html).toContain("https://coachhouse.app/my-organization")
      expect(email.text).toContain("Fiscal sponsorship that feels guided")
    } else {
      expect(email.text).toContain(id === "coach-welcome" ? "Coach welcome" : "Member roundup")
    }
  })
})
