import "server-only"

import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { guestDraftRequestSchema, guestDraftResponseSchema } from "../lib/guest-draft"
import {
  guestIntakeConfiguration, guestRequestIdentity, guestRiskKey,
  hashGuestCapability, readGuestCapability, readGuestJson,
} from "./guest-request-security"

function reply(body: object, status = 200, retryAfter?: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store", Vary: "Cookie",
    ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } })
}
const unavailable = () => reply({ error: "We couldn’t confirm your draft was saved. Keep this page open and retry." }, 503)

// POST for both operations: private answers never enter URLs or cacheable GETs.
export async function handleGuestFiscalDraft(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config) return unavailable()
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  const capability = readGuestCapability(request, config.riskSecret)
  if (!capability) return reply({ error: "Your draft session expired. Keep a copy before starting again." }, 401)
  let value: unknown
  try { value = await readGuestJson(request) } catch { return reply({ error: "Check the draft and retry." }, 400) }
  const parsed = guestDraftRequestSchema.safeParse(value)
  if (!parsed.success) return reply({ error: "Check the draft and retry." }, 400)
  try {
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", {
      p_key_hash: guestRiskKey(config.riskSecret, "draft-ip", ip), p_limit: 100, p_window_seconds: 60,
    })
    if (limit.error) return unavailable()
    if (limit.data !== true) return reply({ error: "Please wait before saving again." }, 429, 60)
    const common = {
      p_key_hash: hashGuestCapability(capability),
      p_expires_at: new Date(Number(capability.split(".")[1]) * 1000).toISOString(),
    }
    const input = parsed.data
    const result = input.operation === "read"
      ? await admin.rpc("read_fiscal_guest_draft", common)
      : await admin.rpc("save_fiscal_guest_draft", { ...common,
        p_version: input.version, p_request_id: input.requestId, p_draft: input.draft,
      })
    if (result.error) return unavailable()
    const output = guestDraftResponseSchema.parse(result.data)
    return reply(output, output.state === "conflict" ? 409 : output.state === "expired" ? 401 : 200)
  } catch { return unavailable() }
}
