import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import type { CompanionConsentState } from "../../types"
export type { CompanionConsentState } from "../../types"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CompanionError } from "../errors"
import { getCompanionLiveConfig, assertCompanionAllowedUser } from "./config"
import { validateCompanionUpstreamRedirect } from "./oauth-broker"

const MAX_BODY = 8192
const CONSENT_LIFETIME = 10 * 60 * 1000
const ID = /^[A-Za-z0-9_-]{8,200}$/
const ALLOWED_SCOPES = new Set(["openid", "email", "profile"])
const RESPONSE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" }


type ConsentClaim = { authorizationId: string; userId: string; fingerprint: string; expiresAt: number }
class ConsentError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

function configuration() {
  if (process.env.COMPANION_LIVE_ENABLED !== "1") throw new ConsentError(503, "unavailable", "This connection is not available yet.")
  const config = getCompanionLiveConfig()
  const secret = process.env.COMPANION_CONSENT_SECRET
  if (!secret || secret.length < 32) throw new ConsentError(503, "unavailable", "This connection is not available yet.")
  return { ...config, secret }
}

function authorizationId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) throw new ConsentError(400, "invalid_request", "Return to the app and start a new connection request.")
  return value
}

function safeHttpsUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) throw new ConsentError(400, "invalid_request", "The connection request has an invalid return address.")
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid address")
    return url
  } catch { throw new ConsentError(400, "invalid_request", "The connection request has an invalid return address.") }
}

function validateDetails(value: unknown, id: string, userId: string, clientId: string, callback: string): OAuthAuthorizationDetails {
  if (!value || typeof value !== "object" || !("authorization_id" in value)) {
    throw new ConsentError(409, "details_unavailable", "This request no longer has reviewable details. Return to the app to reconnect; if this continues, contact Coach House support.")
  }
  const details = value as OAuthAuthorizationDetails
  if (details.authorization_id !== id || details.user?.id !== userId || details.client?.id !== clientId) {
    throw new ConsentError(403, "request_mismatch", "This connection request does not match your account or the approved app.")
  }
  if (typeof details.client.name !== "string" || !details.client.name.trim() || details.client.name.length > 200 || typeof details.scope !== "string" || details.scope.length > 512) {
    throw new ConsentError(400, "invalid_request", "The connection request is incomplete. Return to the app and try again.")
  }
  const scopes = details.scope.trim().split(/\s+/).filter(Boolean)
  if (!scopes.length || scopes.some((scope) => !ALLOWED_SCOPES.has(scope))) {
    throw new ConsentError(403, "unsupported_scope", "This app requested permissions that this connection does not support.")
  }
  if (safeHttpsUrl(details.redirect_uri).href !== safeHttpsUrl(callback).href) {
    throw new ConsentError(403, "request_mismatch", "This connection request has an unexpected return address.")
  }
  return details
}

function fingerprint(details: OAuthAuthorizationDetails) {
  return createHash("sha256").update(JSON.stringify({
    authorizationId: details.authorization_id, clientId: details.client.id, clientName: details.client.name,
    redirectUri: details.redirect_uri, scopes: details.scope.trim().split(/\s+/).sort(),
  })).digest("base64url")
}

function sign(claim: ConsentClaim, secret: string) {
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

function verify(token: unknown, secret: string, id: string, userId: string): ConsentClaim {
  const invalid = () => new ConsentError(403, "invalid_consent", "This review expired or changed. Reload the consent page before deciding.")
  if (typeof token !== "string" || token.length > 2048) throw invalid()
  const [body, signature, extra] = token.split(".")
  if (!body || !signature || extra) throw invalid()
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid()
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString()) as ConsentClaim
    if (claim.authorizationId !== id || claim.userId !== userId || typeof claim.fingerprint !== "string" ||
      !Number.isSafeInteger(claim.expiresAt) || claim.expiresAt <= Date.now() || claim.expiresAt > Date.now() + CONSENT_LIFETIME) throw invalid()
    return claim
  } catch { throw invalid() }
}

export async function loadCompanionConsent(value: unknown): Promise<CompanionConsentState> {
  try {
    const config = configuration()
    const id = authorizationId(value)
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      const destination = `/oauth/consent?${new URLSearchParams({ authorization_id: id })}`
      return { status: "login", href: `/login?${new URLSearchParams({ redirect: destination })}` }
    }
    assertCompanionAllowedUser(user.id, getCompanionLiveConfig().allowedUserIds)
    const result = await supabase.auth.oauth.getAuthorizationDetails(id)
    if (result.error) throw new ConsentError(400, "invalid_request", "This connection request is unavailable. Return to the app and try again.")
    if (result.data && "redirect_url" in result.data && !("authorization_id" in result.data)) {
      const target = safeHttpsUrl(result.data.redirect_url)
      const callback = safeHttpsUrl(config.upstreamRedirectUri)
      if (target.origin !== callback.origin || target.pathname !== callback.pathname || !await validateCompanionUpstreamRedirect(target.href)) {
        throw new ConsentError(403, "request_mismatch", "This connection request is no longer valid. Return to the app and reconnect.")
      }
      return { status: "redirect", href: target.href }
    }
    const details = validateDetails(result.data, id, user.id, config.clientId, config.upstreamRedirectUri)
    let clientWebsite: string | null = null
    try { clientWebsite = safeHttpsUrl(details.client.uri).href } catch { /* Optional metadata is not an authorization target. */ }
    return {
      status: "ready", authorizationId: id,
      csrfToken: sign({ authorizationId: id, userId: user.id, fingerprint: fingerprint(details), expiresAt: Date.now() + CONSENT_LIFETIME }, config.secret),
      clientName: details.client.name, clientWebsite, accountEmail: user.email ?? "Your Coach House account",
      scopes: [...new Set(details.scope.trim().split(/\s+/))],
    }
  } catch (error) {
    return { status: "unavailable", message: (error instanceof ConsentError || error instanceof CompanionError) ? error.message : "This connection is unavailable. Return to the app and try again later." }
  }
}

async function readDecision(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new ConsentError(415, "invalid_request", "Use the consent page to make this decision.")
  }
  const reader = request.body?.getReader()
  if (!reader) throw new ConsentError(400, "invalid_request", "A consent decision is required.")
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.length
    if (length > MAX_BODY) { await reader.cancel(); throw new ConsentError(413, "invalid_request", "The consent request is too large.") }
    chunks.push(value)
  }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString()) }
  catch { throw new ConsentError(400, "invalid_request", "The consent request is invalid.") }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ConsentError(400, "invalid_request", "A consent decision is required.")
  const fields = body as Record<string, unknown>
  if (Object.keys(fields).some((key) => !["authorizationId", "csrfToken", "decision"].includes(key)) || (fields.decision !== "approve" && fields.decision !== "deny")) {
    throw new ConsentError(400, "invalid_request", "Use the consent page to approve or deny access.")
  }
  return { id: authorizationId(fields.authorizationId), token: fields.csrfToken, decision: fields.decision as "approve" | "deny" }
}

export async function handleCompanionAuthorization(request: Request): Promise<Response> {
  try {
    const config = configuration()
    if (request.method !== "POST") return Response.json({ error: "Use POST to make a consent decision." }, { status: 405, headers: { ...RESPONSE_HEADERS, Allow: "POST" } })
    if (new URL(request.url).origin !== config.publicOrigin || request.headers.get("origin") !== config.publicOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new ConsentError(403, "origin_denied", "Use the Coach House consent page to make this decision.")
    }
    const decision = await readDecision(request)
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new ConsentError(401, "unauthorized", "Sign in again, then reload the consent page.")
    assertCompanionAllowedUser(user.id, getCompanionLiveConfig().allowedUserIds)
    const claim = verify(decision.token, config.secret, decision.id, user.id)
    const result = await supabase.auth.oauth.getAuthorizationDetails(decision.id)
    if (result.error) throw new ConsentError(400, "invalid_request", "This connection request is no longer available. Return to the app and try again.")
    const details = validateDetails(result.data, decision.id, user.id, config.clientId, config.upstreamRedirectUri)
    if (fingerprint(details) !== claim.fingerprint) throw new ConsentError(409, "review_changed", "The request changed after you reviewed it. Reload the consent page.")
    assertCompanionAllowedUser(user.id, getCompanionLiveConfig().allowedUserIds)
    const resolved = decision.decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(decision.id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(decision.id, { skipBrowserRedirect: true })
    if (resolved.error || !resolved.data) throw new ConsentError(502, "authorization_failed", "The app did not receive your decision. Return to the app to check its connection before retrying.")
    const target = safeHttpsUrl(resolved.data.redirect_url)
    const registered = safeHttpsUrl(details.redirect_uri)
    if (target.origin !== registered.origin || target.pathname !== registered.pathname || [...registered.searchParams].some(([key, value]) => target.searchParams.get(key) !== value) || !await validateCompanionUpstreamRedirect(target.href)) {
      throw new ConsentError(502, "redirect_mismatch", "The app returned an unexpected address. Return to the app to check your connection.")
    }
    return Response.json({ redirectTo: target.href }, { headers: RESPONSE_HEADERS })
  } catch (error) {
    const known = error instanceof ConsentError || error instanceof CompanionError
    return Response.json({ error: known ? error.message : "This connection is unavailable. Return to the app and try again later.", code: known ? error.code : "unavailable" },
      { status: known ? error.status : 503, headers: RESPONSE_HEADERS })
  }
}
