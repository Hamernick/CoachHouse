import { sendResendEmail } from "@/lib/email/resend"
import { env } from "@/lib/env"
import { buildCoachingBookingEmail, type CoachingBookingEmailInput } from "../lib/email-templates"

function dedupeEmails(emails: Array<string | null | undefined>) {
  const seen = new Set<string>()
  return emails
    .map((email) => email?.trim() ?? "")
    .filter((email) => email.length > 0)
    .filter((email) => {
      const key = email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export async function sendCoachingBookingConfirmationEmails(input: Omit<CoachingBookingEmailInput, "siteUrl" | "audience"> & {
  coachEmails: string[]
  bookingId: string
}) {
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "https://coachhouse.app").replace(/\/+$/, "")
  const recipients = [
    { audience: "attendee" as const, emails: dedupeEmails([input.attendeeEmail]), category: "coaching-booking-confirmed" },
    { audience: "coach" as const, emails: dedupeEmails(input.coachEmails), category: "coaching-booking-coach-notice" },
  ]
  const results = await Promise.all(recipients.filter(({ emails }) => emails.length > 0).map(({ audience, emails, category }) =>
    sendResendEmail({
      to: emails,
      ...buildCoachingBookingEmail({ ...input, audience, siteUrl }),
      tags: [{ name: "category", value: category }, { name: "booking", value: input.bookingId }],
    })
  ))
  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    console.error("Failed to send coaching booking email", {
      bookingId: input.bookingId,
      errors: failed.map((result) => ("error" in result ? result.error : "unknown_error")),
    })
  }
}
