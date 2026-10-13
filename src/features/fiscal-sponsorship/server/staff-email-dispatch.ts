import "server-only"

import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { canSendResendEmail, sendResendEmail } from "@/lib/email/resend"
import { env } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const jobSchema = z.object({
  event_id: z.string().uuid(),
  project_id: z.string().uuid(),
  event_type: z.string().min(1).max(200),
  lease_token: z.string().uuid(),
})

function escapeHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

export function authorizeFiscalEmailCron(request: Request) {
  const expected = process.env.INTERNAL_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get("authorization")
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null
  if (!expected || !supplied) return false
  const left = Buffer.from(supplied), right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function dispatchFiscalStaffEmails() {
  if (process.env.FISCAL_STAFF_EMAILS_ENABLED !== "true" || !canSendResendEmail()) throw new Error("Fiscal staff email is not configured")
  const site = new URL(env.NEXT_PUBLIC_SITE_URL || "https://coachhouse.app")
  if (site.protocol !== "https:") throw new Error("Fiscal email requires a secure site URL")
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("claim_fiscal_staff_emails")
  if (error) throw new Error("Fiscal notification queue unavailable")
  const jobs = z.array(jobSchema).parse(data)
  let sent = 0
  let failed = 0
  for (const job of jobs) {
    // No application answers, legal details, or attachments leave the secured project.
    const step = job.event_type.replaceAll("_", " ")
    const url = new URL(`/projects/${job.project_id}`, site).toString()
    let result: Awaited<ReturnType<typeof sendResendEmail>>
    try {
      result = await sendResendEmail({
        to: "fs@coachhousesolutions.org",
        signal: AbortSignal.timeout(8000),
        subject: "Fiscal sponsorship update",
        text: `A fiscal sponsorship step was completed: ${step}.\n\nReview the project: ${url}\n\nSign in with your Coach House staff account.`,
        html: `<p>A fiscal sponsorship step was completed: ${escapeHtml(step)}.</p><p><a href="${escapeHtml(url)}">Review the project</a></p><p>Sign in with your Coach House staff account.</p>`,
        idempotencyKey: `fiscal-staff-event/${job.event_id}`,
        tags: [{ name: "category", value: "fiscal-staff-update" }],
      })
    } catch {
      result = { ok: false, error: "provider_unavailable" }
    }
    const completion = await supabase.rpc("finish_fiscal_staff_email", {
      p_event_id: job.event_id, p_lease_token: job.lease_token,
      p_message_id: result.ok ? result.id : null, p_success: result.ok,
    })
    if (completion.error || completion.data !== true) throw new Error("Fiscal notification delivery could not be recorded")
    if (result.ok) sent += 1
    else failed += 1
  }
  return { sent, failed }
}

export async function handleFiscalEmailCron(request: Request) {
  if (!authorizeFiscalEmailCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await dispatchFiscalStaffEmails(), { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Fiscal notification delivery unavailable" }, { status: 503 })
  }
}
