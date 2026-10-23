import "server-only"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { writeActiveOrganizationCookie } from "@/lib/organization/active-org-cookie"
import { GUEST_ORGANIZATION_PROFILE_HREF, guestProfilePreviewSchema, guestProfileRequestSchema } from "../lib/guest-profile"
import { guestIntakeConfiguration, guestRequestIdentity, guestRiskKey, hashGuestCapability, readGuestCapability, readGuestJson } from "./guest-request-security"

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: {
  "Cache-Control": "no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer",
} })

export async function handleGuestFiscalProfile(request: Request) {
  const config = guestIntakeConfiguration()
  if (!config) return reply({ error: "Profile saving is unavailable." }, 503)
  const ip = guestRequestIdentity(request, config.origin)
  if (!ip) return reply({ error: "Request not allowed." }, 403)
  const capability = readGuestCapability(request, config.riskSecret)
  if (!capability && process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return reply({ error: "Open your application verification email in this browser first.", code: "verification_required" }, 403)
  let body: unknown
  try { body = await readGuestJson(request) } catch { return reply({ error: "Invalid request." }, 400) }
  const parsed = guestProfileRequestSchema.safeParse(body)
  if (!parsed.success) return reply({ error: "Check the selected profile fields." }, 400)
  try {
    // getUser revalidates the account with Auth; never trust getSession/user metadata.
    const auth = await createSupabaseServerClient()
    const { data: { user }, error } = await auth.auth.getUser()
    if (error || !user) return reply({ error: "Sign in to save your profile.", code: "sign_in" }, 401)
    if (!user.email_confirmed_at) return reply({ error: "Confirm your account email before continuing.", code: "account_unverified" }, 403)
    const admin = createSupabaseAdminClient()
    const limit = await admin.rpc("consume_fiscal_guest_limit", { p_key_hash: guestRiskKey(config.riskSecret, "profile-ip", ip), p_limit: 30, p_window_seconds: 900 })
    if (limit.error) throw new Error("limit_unavailable")
    if (!limit.data) return reply({ error: "Please wait before trying again." }, 429)
    if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED === "true") {
      const linked = await auth.rpc("fiscal_profile_owner_linked", { p_reference: parsed.data.reference })
      if (linked.error) throw new Error("profile_unavailable")
      if (linked.data === true) {
        // Reopen an existing claim; never copy answers or claim without proof.
        if (parsed.data.operation === "open") {
          await writeActiveOrganizationCookie(user.id)
          return reply({ state: "opened", href: GUEST_ORGANIZATION_PROFILE_HREF })
        }
        return reply({ state: "linked" })
      }
    }
    if (!capability) return reply({ error: "Open your application verification email in this browser first.", code: "verification_required" }, 403)
    const base = { p_reference: parsed.data.reference, p_key_hash: hashGuestCapability(capability), p_user_id: user.id }
    const result = parsed.data.operation === "save"
      ? await admin.rpc("save_fiscal_guest_profile", { ...base, p_request_id: parsed.data.requestId, p_version: parsed.data.version, p_fields: parsed.data.fields })
      : await admin.rpc("preview_fiscal_guest_profile", base)
    if (result.error) throw new Error("profile_unavailable")
    if (!result.data) return reply({ error: "Verify the application email in this browser and sign in with the same email address.", code: "verification_required" }, 403)
    const state = typeof result.data === "object" && !Array.isArray(result.data) ? result.data.state : null
    if (parsed.data.operation === "open") {
      if (state !== "linked") return reply({ error: "Link your application first." }, 403)
      await writeActiveOrganizationCookie(user.id)
      return reply({ state: "opened", href: GUEST_ORGANIZATION_PROFILE_HREF })
    }
    if (state === "linked" || state === "already_linked") return reply({ state: "linked" })
    if (state === "conflict" || state === "public_profile") return reply({ error: "Your profile changed. Reload the preview before choosing what to save.", code: "conflict" }, 409)
    return reply(guestProfilePreviewSchema.parse(result.data))
  } catch { return reply({ error: "We couldn’t confirm the result. Retry the same request." }, 503) }
}
