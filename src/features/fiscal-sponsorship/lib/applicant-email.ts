import { renderMinimalEmail } from "@/lib/email/minimal-template"
import { guestReceiptDetails } from "./guest-receipt-copy"

type ApplicantEmailInput = {
  kind: "applicant_receipt" | "applicant_update" | "applicant_recovery"
  projectName: string
  verificationUrl: string
  receiptSnapshot?: Record<string, unknown> | null
  eventType?: string
}

const updateCopy: Record<string, { title: string; intro: string }> = {
  application_needs_info: { title: "More information requested", intro: "Coach House needs a few more details to continue reviewing your application. Open your application to see the requested corrections and respond." },
  application_approved: { title: "Your application has been approved", intro: "Coach House approved your fiscal sponsorship application. Open your application to review the current status and next steps." },
  application_declined: { title: "Your application review is complete", intro: "Coach House has completed its review and is unable to approve this application. Open your application to read the decision and any review notes." },
  application_submitted: { title: "We received your corrections", intro: "Your updated application is back with the Coach House team for review. You do not need to submit another application." },
}

/** Only the applicant receives this private access link and submitted-answer copy. */
export function fiscalApplicantEmail(input: ApplicantEmailInput) {
  const project = input.projectName.trim() || "Your project"
  const receipt = input.kind === "applicant_receipt"
  const recovery = input.kind === "applicant_recovery"
  const update = updateCopy[input.eventType ?? ""] ?? { title: "Your application has an update", intro: "Open your application to view its current status and any requested corrections." }
  const title = receipt ? "We received your application" : recovery ? "Your application access link" : update.title
  const intro = receipt
    ? "Your fiscal sponsorship application is submitted. No account or email confirmation is needed to submit. Coach House will review it and contact you. This receipt does not mean your project has been approved."
    : recovery ? "You requested access to your fiscal sponsorship application. Your application has not changed." : update.intro
  const answers = receipt && input.receiptSnapshot ? guestReceiptDetails(input.receiptSnapshot) : null
  const subject = `${title}: ${project.replace(/[\r\n]+/g, " ").slice(0, 150)}`
  return { subject, ...renderMinimalEmail({
    siteUrl: new URL(input.verificationUrl).origin,
    eyebrow: "Fiscal sponsorship",
    title,
    intro,
    details: [{ label: "Project", value: project }],
    sections: answers ? [{ title: "COPY OF YOUR SUBMITTED ANSWERS", details: answers }] : [],
    action: { label: "Verify email", href: input.verificationUrl },
    body: receipt ? ["Optional: use your private link to check status, respond to requested corrections or save selected details to a profile. You can read and keep this receipt without opening the link."] : [],
    helpText: "No account is required. This private link expires in seven days. Opening it does not verify your email; choose Verify email on the page. You can verify on your phone and return to the original browser where you applied.",
    footer: recovery ? "If you did not request this link, you can ignore this email." : "Keep this access link private. Email verification does not create an account.",
    previewText: receipt ? "Your application is submitted. Keep this receipt for your records." : recovery ? "Use your private link to access your application." : "View the latest update to your application.",
  }) }
}
