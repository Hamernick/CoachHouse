import "server-only"

import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { guestApplicationPayload, guestSubmissionSchema } from "../lib/guest-submission-schema"
import {
  GUEST_COOKIE, guestIntakeConfiguration, guestRequestIdentity, guestRiskKey,
  hashGuestCapability, issueGuestCapability, readGuestCapability, readGuestJson, verifyGuestCaptcha,
} from "./guest-request-security"

function reply(body: object, status = 200, retryAfter?: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store", "Vary": "Cookie",
    ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } })
}
const unavailable = () => reply({ error: "We couldn’t confirm your submission. Please retry." }, 503)
const referenceSchema = z.object({ submissionId: z.string().uuid() })

export async function handleGuestFiscalSession(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config) return unavailable()
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  try {
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "session-ip", ip), p_limit: 20, p_window_seconds: 900,
    })
    if (limit.error) return unavailable()
    if (limit.data !== true) return reply({ error: "Please wait before trying again." }, 429, 900)
    const existing = readGuestCapability(request, config.riskSecret)
    const response = reply({ ok: true })
    if (!existing) response.cookies.set(GUEST_COOKIE, issueGuestCapability(config.riskSecret), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 7 * 86400,
    })
    return response
  } catch { return unavailable() }
}

export async function handleGuestFiscalSubmission(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config) return unavailable()
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  const capability = readGuestCapability(request, config.riskSecret)
  if (!capability) return reply({ error: "Your application session expired. Start a new session and try again." }, 401)
  let value: unknown
  try { value = await readGuestJson(request) } catch { return reply({ error: "Check the application and try again." }, 400) }
  const parsed = guestSubmissionSchema.safeParse(value)
  if (!parsed.success) return reply({ error: "Check the highlighted fields.", fields: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, 400)
  try {
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "submit-ip", ip), p_limit: 20, p_window_seconds: 900,
    })
    if (limit.error) return unavailable()
    if (limit.data !== true) return reply({ error: "Please wait before trying again." }, 429, 900)
    const keyHash = hashGuestCapability(capability)
    const existing = await admin.rpc("get_fiscal_guest_receipt", { p_key_hash: keyHash })
    if (existing.error) return unavailable()
    if (existing.data !== null) {
      const receipt = referenceSchema.parse(existing.data)
      return reply({ ok: true, reference: receipt.submissionId })
    }
    if (!(await verifyGuestCaptcha(config, parsed.data.captchaToken, ip))) return reply({ error: "Please complete the verification again.", captchaRequired: true }, 400)
    const emailLimit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "submit-email", parsed.data.application.primaryEmail), p_limit: 3, p_window_seconds: 86400,
    })
    if (emailLimit.error) return unavailable()
    if (emailLimit.data !== true) return reply({ error: "Please wait before trying again." }, 429, 86400)
    const result = await admin.rpc("submit_guest_fiscal_application", {
      p_submission_key_hash: keyHash, p_application: guestApplicationPayload(parsed.data.application),
    })
    if (result.error) return unavailable()
    const receipt = referenceSchema.parse(result.data)
    return reply({ ok: true, reference: receipt.submissionId }, 201)
  } catch { return unavailable() }
}
