import "server-only"

import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { guestEmailProofSecret } from "./guest-email-proof-token"
import { guestIntakeConfiguration, guestRequestIdentity, guestRiskKey, readGuestJson } from "./guest-request-security"

const schema = z.object({
  reference: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254),
  requestId: z.string().uuid(),
  // Accept ignored tokens from forms loaded before CAPTCHA removal.
  captchaToken: z.string().max(10000).optional(),
}).strict()
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: {
  "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
} })

export function guestFiscalRecoveryAvailable() {
  return Boolean(guestIntakeConfiguration() && guestEmailProofSecret() && process.env.FISCAL_GUEST_EMAILS_ENABLED === "true")
}

export async function handleGuestFiscalRecovery(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config || !guestEmailProofSecret() || process.env.FISCAL_GUEST_EMAILS_ENABLED !== "true") {
    return reply({ error: "Application access links are temporarily unavailable. Please try again later." }, 503)
  }
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  let body: unknown
  try { body = await readGuestJson(request) } catch { return reply({ error: "Check your reference and email." }, 400) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return reply({ error: "Check your reference and email." }, 400)
  try {
    const admin = createSupabaseAdminClient()
    const ipLimit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "recovery-ip", ip), p_limit: 10, p_window_seconds: 900,
    })
    if (ipLimit.error) throw new Error("limit_unavailable")
    if (ipLimit.data !== true) return reply({ error: "Please wait before requesting another link." }, 429)
    const emailLimit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "recovery-email", parsed.data.email), p_limit: 3, p_window_seconds: 86400,
    })
    if (emailLimit.error) throw new Error("limit_unavailable")
    // Same response for unknown applications, mismatches, cooldowns and email limits.
    if (emailLimit.data === true) {
      const result = await admin.rpc("request_fiscal_guest_recovery", {
        p_reference: parsed.data.reference, p_email: parsed.data.email, p_request_id: parsed.data.requestId,
      })
      if (result.error) throw new Error("recovery_unavailable")
    }
    return reply({ ok: true }, 202)
  } catch { return reply({ error: "We couldn’t confirm your request. Please retry." }, 503) }
}
