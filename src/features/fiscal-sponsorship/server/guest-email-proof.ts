import "server-only"
import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { guestEmailProofSecret, signGuestEmailProof, validGuestEmailProof } from "./guest-email-proof-token"
import { guestIntakeConfiguration, guestRequestIdentity, guestRiskKey, hashGuestCapability, readGuestCapability, readGuestJson } from "./guest-request-security"

export async function prepareGuestEmailProofLink(jobId: string, leaseToken: string, site: URL) {
  const secret = guestEmailProofSecret()
  if (!secret) throw new Error("Email verification is not configured")
  const nonce = randomBytes(32).toString("hex")
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + 7 * 86400) * 1000).toISOString()
  const token = signGuestEmailProof(jobId, nonce, expiresAt, secret)
  const { data, error } = await createSupabaseAdminClient().rpc("prepare_fiscal_guest_email_proof", {
    p_job_id: jobId, p_lease_token: leaseToken, p_nonce: nonce, p_token_hash: hashGuestCapability(token), p_expires_at: expiresAt,
  })
  if (error) throw new Error("Email verification link unavailable")
  const stored = z.object({ nonce: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.string().datetime({ offset: true }), tokenHash: z.string() }).parse(data)
  const stableToken = signGuestEmailProof(jobId, stored.nonce, stored.expiresAt, secret)
  // A key change must fail closed, not resend different content under the same provider key.
  if (hashGuestCapability(stableToken) !== stored.tokenHash) throw new Error("Email verification key mismatch")
  const url = new URL("/documentation/fiscal-sponsorship/verify", site)
  url.hash = `verify=${stableToken}`
  return url.toString()
}

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: {
  "Cache-Control": "no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer",
} })
export async function handleGuestFiscalEmailVerification(request: Request) {
  const config = guestIntakeConfiguration(), secret = guestEmailProofSecret()
  if (!config || !secret) return reply({ error: "Email verification is unavailable. Please try again later." }, 503)
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  const capability = readGuestCapability(request, config.riskSecret)
  if (!capability) return reply({ error: "Please reopen the link and try again." }, 401)
  let body: unknown
  try { body = await readGuestJson(request) } catch { return reply({ error: "Invalid verification link." }, 400) }
  const parsed = z.object({ token: z.string().max(256) }).strict().safeParse(body)
  if (!parsed.success || !validGuestEmailProof(parsed.data.token, secret)) return reply({ error: "This link is invalid or expired." }, 400)
  try {
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", { p_key_hash: guestRiskKey(config.riskSecret, "verify-ip", ip), p_limit: 20, p_window_seconds: 900 })
    if (limit.error) throw new Error("limit_unavailable")
    if (limit.data !== true) return reply({ error: "Please wait before trying again." }, 429)
    const result = await admin.rpc("verify_fiscal_guest_email", { p_token_hash: hashGuestCapability(parsed.data.token),
      p_key_hash: hashGuestCapability(capability), p_expires_at: new Date(Number(capability.split(".")[1]) * 1000).toISOString() })
    if (result.error) throw new Error("verification_unavailable")
    if (!result.data) return reply({ error: "This link has expired or was already used in another browser." }, 400)
    const receipt = z.object({ reference: z.string().uuid() }).strict().parse(result.data)
    return reply({ ok: true, ...receipt })
  } catch { return reply({ error: "We couldn’t confirm verification. Please retry." }, 503) }
}
