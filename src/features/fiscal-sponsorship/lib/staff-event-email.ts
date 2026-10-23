import { renderMinimalEmail } from "@/lib/email/minimal-template"

const events: Record<string, [string, string]> = {
  application_approved: ["Application approved", "The fiscal sponsorship application was approved. Review the project for the next steps."],
  application_needs_info: ["More information requested", "The applicant has been asked for additional information. Review the project to follow up."],
  application_declined: ["Application declined", "The application review is complete and the application was declined. The decision is recorded in the project."],
  document_connected: ["Document received", "A required document is available for review in the project."],
  document_uploaded: ["Document received", "A required document is available for review in the project."],
  document_reviewed: ["Document review updated", "A document review was recorded. Open the project to see the review outcome."],
  agreement_ready: ["Agreement prepared", "The fiscal sponsorship agreement has been prepared. Review it in the project."],
  agreement_sent: ["Agreement sent for signature", "The applicant has been invited to review and sign the fiscal sponsorship agreement."],
  agreement_signed: ["Applicant signature received", "The applicant has signed the fiscal sponsorship agreement. Review the project for countersigning."],
  agreement_countersigned: ["Agreement countersigned", "The fiscal sponsorship agreement has been countersigned. Review the completed agreement in the project."],
  agreement_completed: ["Agreement completed", "The fiscal sponsorship agreement is complete. Open the project to view the signed agreement."],
  w9_completed: ["W-9 completed", "The applicant completed the W-9 step. Review the project for its current document status."],
}

export function fiscalStaffEventEmail({ eventType, projectName, url }: { eventType: string; projectName: string; url: string }) {
  const [title, intro] = events[eventType] ?? ["Project update", "A fiscal sponsorship update is available. Open the project to review its current status and next steps."]
  const project = projectName.trim() || "Fiscal sponsorship project"
  return { subject: `FS ${title.toLowerCase()}: ${project.replace(/[\r\n]+/g, " ").slice(0, 150)}`, ...renderMinimalEmail({
    siteUrl: new URL(url).origin,
    eyebrow: "Fiscal sponsorship",
    title,
    intro,
    details: [{ label: "Project", value: project }],
    action: { label: "Review project", href: url },
    helpText: "Sign in with your Coach House staff account.",
    previewText: "Review the latest fiscal sponsorship update in Coach House.",
  }) }
}
