import "server-only"
import { z } from "zod"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { guestFollowupRequestSchema, parseGuestFollowup } from "../lib/guest-followup"
import { guestApplicationPayload } from "../lib/guest-submission-schema"
import { guestIntakeConfiguration, guestRequestIdentity, guestRiskKey, hashGuestCapability, readGuestCapability, readGuestJson } from "./guest-request-security"
import { loadLinkedFiscalFollowup } from "./linked-applications"

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: {
  "Cache-Control": "no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer",
} })
export async function handleGuestFiscalFollowup(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config) return reply({ error: "Application updates are unavailable." }, 503)
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  const capability = readGuestCapability(request, config.riskSecret)
  const denied = () => reply({ error: "Verify your application email, then check again here. If you verified on your phone, use the original browser where you applied. In another browser, request a new access link.", code: "verification_required" }, 403)
  if (!capability && process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return denied()
  let body: unknown
  try { body = await readGuestJson(request) } catch { return reply({ error: "Invalid request." }, 400) }
  const parsed = guestFollowupRequestSchema.safeParse(body)
  if (!parsed.success) return reply({ error: "Check the application answers." }, 400)
  try {
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", { p_key_hash: guestRiskKey(config.riskSecret, "followup-ip", ip), p_limit: 40, p_window_seconds: 900 })
    if (limit.error) throw new Error("limit_unavailable")
    if (limit.data !== true) return reply({ error: "Please wait before trying again." }, 429)
    let result = { data: await loadLinkedFiscalFollowup(parsed.data), error: null } as { data: unknown; error: unknown }
    if (!result.data && capability) {
      const base = { p_reference: parsed.data.reference, p_key_hash: hashGuestCapability(capability) }
      result = parsed.data.operation === "read"
        ? await admin.rpc("read_fiscal_guest_application", base)
        : await admin.rpc("resubmit_fiscal_guest_application", { ...base, p_request_id: parsed.data.requestId,
          p_version: parsed.data.version, p_application: guestApplicationPayload(parsed.data.application) })
    }
    if (result.error) throw new Error("followup_unavailable")
    if (!result.data) return denied()
    if (parsed.data.operation === "read") return reply(parseGuestFollowup(result.data))
    const state = z.object({ state: z.enum(["submitted", "conflict", "email_change"]) }).strict().parse(result.data).state
    if (state === "conflict") return reply({ error: "The application changed. Check its current status before sending corrections.", code: "conflict" }, 409)
    if (state === "email_change") return reply({ error: "Keep your verified email address. Contact fs@coachhousesolutions.org to change it." }, 400)
    return reply({ state: "submitted" })
  } catch { return reply({ error: "We couldn’t confirm the result. Retry the same request." }, 503) }
}
