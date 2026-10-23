import "server-only"

import { NextResponse } from "next/server"
import { z } from "zod"
import { sendResendEmail, canSendResendEmail } from "@/lib/email/resend"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { authorizeFiscalEmailCron } from "./staff-email-dispatch"
import { prepareGuestEmailProofLink } from "./guest-email-proof"
import { guestEmailProofSecret } from "./guest-email-proof-token"
import { reviewerEmailDigest } from "../lib/reviewer-email-digest"
import { fiscalApplicantEmail } from "../lib/applicant-email"
import { guestReceiptCopy } from "../lib/guest-receipt-copy"

const jobSchema = z.object({
  id: z.string().uuid(), submissionId: z.string().uuid(), projectId: z.string().uuid(),
  kind: z.enum(["applicant_receipt", "reviewer_notification", "applicant_update", "reviewer_update", "applicant_recovery"]), recipient: z.string().email(), leaseToken: z.string().uuid(),
  templateVersion: z.union([z.literal(1), z.literal(2)]).default(1),
  toRecipients: z.array(z.string().email()).max(2).default([]),
  messageSnapshot: z.object({ projectName: z.string(), eventType: z.string().nullable().optional() }).nullable().optional(),
  ccRecipients: z.array(z.string().email()).max(1).default([]),
  reviewSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  receiptSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
})

export async function dispatchFiscalGuestEmails() {
  if (process.env.FISCAL_GUEST_EMAILS_ENABLED !== "true" || !canSendResendEmail()) throw new Error("Guest email delivery is not configured")
  if (!guestEmailProofSecret()) throw new Error("Email verification is not configured")
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://coachhouse.app")
  if (site.protocol !== "https:") throw new Error("Guest email site must use HTTPS")
  const admin = createSupabaseAdminClient()
  let { data, error } = await admin.rpc("claim_fiscal_guest_emails_v4")
  if (error?.code === "PGRST202" || error?.code === "42883") ({ data, error } = await admin.rpc("claim_fiscal_guest_emails_v3"))
  // Missing migration only: do not retry a possibly committed queue claim after
  // network, permission or database failures. Legacy jobs retain their old copy.
  if (error?.code === "PGRST202" || error?.code === "42883") ({ data, error } = await admin.rpc("claim_fiscal_guest_emails"))
  if (error) throw new Error("Guest email queue unavailable")
  const jobs = z.array(jobSchema).parse(data)
  let sent = 0, failed = 0
  for (const job of jobs) {
    const recovery = job.kind === "applicant_recovery"
    const applicant = job.kind === "applicant_receipt" || job.kind === "applicant_update" || recovery
    const update = job.kind === "applicant_update" || job.kind === "reviewer_update"
    const url = new URL(`/projects/${job.projectId}`, site).toString()
    let result: Awaited<ReturnType<typeof sendResendEmail>>
    try {
      if (job.ccRecipients.length && (applicant || job.ccRecipients[0] !== "caleb@bandto.com")) throw new Error("Invalid fiscal CC scope")
      if (job.templateVersion === 2 && (!job.messageSnapshot || (applicant
        ? job.toRecipients.length > 0 || job.ccRecipients.length > 0
        : !job.reviewSnapshot || job.toRecipients.join(",") !== "joel@coachhousesolutions.org,fs@coachhousesolutions.org" || job.ccRecipients.join(",") !== "caleb@bandto.com"))) throw new Error("Invalid fiscal message envelope")
      const copy = job.kind === "applicant_receipt" && job.receiptSnapshot ? guestReceiptCopy(job.receiptSnapshot) : null
      if (copy && String(job.receiptSnapshot!.primary_email).toLowerCase() !== job.recipient.toLowerCase()) throw new Error("Receipt recipient mismatch")
      const verificationUrl = applicant ? await prepareGuestEmailProofLink(job.id, job.leaseToken, site) : null
      // Frozen proof material and versioned copy keep retries byte-for-byte stable.
      const digest = !applicant && job.reviewSnapshot ? reviewerEmailDigest(job.reviewSnapshot, url, update) : null
      const text = recovery
        ? `You requested access to your fiscal sponsorship application.\n\nReference: ${job.submissionId}\n\nVerify your email to view your application: ${verificationUrl}\n\nNo account is required. This private link expires in seven days. Opening it does not verify your email; choose Verify email on the page. If you did not request this link, you can ignore it. Your application has not changed.`
        : update
        ? applicant
          ? `Your fiscal sponsorship application has an update.\n\nReference: ${job.submissionId}\n\nVerify your email to view the current status and any requested corrections: ${verificationUrl}\n\nNo account is required. This private link expires in seven days. Opening it does not verify your email; choose Verify email on the page.`
          : `A fiscal sponsorship applicant has submitted requested corrections.\n\nReference: ${job.submissionId}\n\nReview the project: ${url}\n\nSign in with your Coach House staff account.`
        : applicant
        ? copy
          ? `We received your fiscal sponsorship application.\n\nReference: ${job.submissionId}\n\nYour application is submitted. No account or email confirmation is needed to submit. Coach House will review it and contact you. This receipt does not mean your project has been approved.\n\nCOPY OF YOUR SUBMITTED ANSWERS\n\n${copy}\n\nOptional: check status, respond to requested corrections or save details to a profile using this private link: ${verificationUrl}\n\nYou can read and keep this email without opening the link. For private online access, choose Verify email on the page. You can verify on your phone and return to the original browser where you applied. This access link expires in seven days; it does not create an account.`
          : `We received your fiscal sponsorship application.\n\nReference: ${job.submissionId}\n\nCoach House will review your application. This receipt does not mean your project has been approved. You do not need an account to apply.\n\nVerify your email: ${verificationUrl}\n\nThis private link expires in seven days. Opening it does not verify your email; choose Verify email on the page. Verification does not create an account.`
        : `A new fiscal sponsorship application is ready for review.\n\nReference: ${job.submissionId}\n\nReview the project: ${url}\n\nSign in with your Coach House staff account.`
      let html = `<div>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;").split("\n\n").map((paragraph) => `<p>${copy ? paragraph.replaceAll("\n", "<br />") : paragraph}</p>`).join("")}</div>`
      if (verificationUrl) html = html.replace(verificationUrl, `<a href="${verificationUrl}">Verify email</a>`)
      const modern = job.templateVersion === 2 && applicant ? fiscalApplicantEmail({
        kind: job.kind as "applicant_receipt" | "applicant_update" | "applicant_recovery",
        projectName: job.messageSnapshot!.projectName, verificationUrl: verificationUrl!,
        receiptSnapshot: job.receiptSnapshot, eventType: job.messageSnapshot!.eventType ?? undefined,
      }) : null
      if (job.templateVersion === 2) {
        const allowed = await admin.rpc("fiscal_guest_email_send_allowed", { p_id: job.id, p_lease_token: job.leaseToken })
        if (allowed.error || allowed.data !== true) throw new Error("Fiscal message recipient unavailable")
      }
      result = await sendResendEmail({
        to: job.toRecipients.length ? job.toRecipients : job.recipient, ...(job.ccRecipients.length ? { cc: job.ccRecipients } : {}), subject: modern?.subject ?? digest?.subject ?? (recovery ? "Your application access link" : update ? "Fiscal sponsorship application updated" : applicant ? "We received your application" : "New fiscal sponsorship application"),
        text: modern?.text ?? digest?.text ?? text, html: modern?.html ?? digest?.html ?? html, signal: AbortSignal.timeout(8000), idempotencyKey: job.templateVersion === 2 ? `fiscal-minimal-v1/${job.kind}/${job.id}` : `fiscal-guest-${digest ? (update ? "digest-update-v1" : "digest-v1") : job.ccRecipients.length ? (update ? "reviewer-update-v2" : "reviewer-v4") : recovery ? "recovery-v1" : update ? "update-v1" : copy ? "receipt-v3" : "v2"}/${job.id}`,
        tags: [{ name: "category", value: applicant ? "fiscal-receipt" : "fiscal-review" }],
      })
    } catch { result = { ok: false, error: "provider_unavailable" } }
    const completion = await admin.rpc("finish_fiscal_guest_email", {
      p_id: job.id, p_lease_token: job.leaseToken, p_success: result.ok, p_message_id: result.ok ? result.id : null,
    })
    if (completion.error || completion.data !== true) throw new Error("Guest email delivery could not be recorded")
    if (result.ok) sent += 1
    else failed += 1
  }
  return { sent, failed }
}

export async function handleGuestFiscalEmailCron(request: Request) {
  if (!authorizeFiscalEmailCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await dispatchFiscalGuestEmails(), { headers: { "Cache-Control": "no-store" } }) }
  catch { return NextResponse.json({ error: "Guest email delivery unavailable" }, { status: 503 }) }
}
