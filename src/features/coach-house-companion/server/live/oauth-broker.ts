import { createHmac } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient, type Database } from "@/lib/supabase"
import { CompanionError } from "../errors"
import { COMPANION_SCOPES, getCompanionLiveConfig, assertCompanionAllowedUser } from "./config"
import { decryptOAuth, encryptOAuth, oauthChallenge, oauthEqual, oauthHash, oauthRandom } from "./oauth-crypto"
import { oauthStore, type OAuthGrant, type OAuthTransaction, type UpstreamSession } from "./oauth-store"

type Config = ReturnType<typeof getCompanionLiveConfig>
const responseHeaders = { "Cache-Control": "no-store", Pragma: "no-cache", "Referrer-Policy": "no-referrer" }
const cookieName = (state: string) => `__Host-chc-oauth-${oauthHash(state).slice(0, 16)}`
const opaque = (kind: "at" | "rt" | "code") => `chc_${kind}_${oauthRandom()}`

function fail(code = "invalid_request", status = 400): never {
  throw new CompanionError(code, status, "The Coach House connection request is invalid or expired. Connect again.")
}

function unique(params: URLSearchParams) {
  const keys = [...params.keys()]
  if (keys.some(key => params.getAll(key).length !== 1)) fail()
  return params
}

async function readForm(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") fail()
  const reader = request.body?.getReader()
  if (!reader) fail()
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const item = await reader.read()
    if (item.done) break
    size += item.value.length
    if (size > 8192) { await reader.cancel(); fail("invalid_request", 413) }
    chunks.push(item.value)
  }
  return unique(new URLSearchParams(Buffer.concat(chunks).toString("utf8")))
}

function requestedScopes(value: string | null, fallback = true) {
  const scopes = [...new Set((value ?? (fallback ? COMPANION_SCOPES.join(" ") : "")).split(/\s+/).filter(Boolean))]
  if (!scopes.includes("accelerator:read") || scopes.some(scope => !(COMPANION_SCOPES as readonly string[]).includes(scope))) fail("invalid_scope")
  return scopes
}

function validateClient(params: URLSearchParams, config: Config) {
  if (params.get("client_id") !== config.chatgptClientId) fail("invalid_client", 401)
  if (params.has("client_secret")) fail("invalid_client", 401)
}

function validateResource(params: URLSearchParams, config: Config) {
  if (params.get("resource") !== config.resource) fail("invalid_target")
}

async function authorize(request: NextRequest, config: Config) {
  const params = unique(new URL(request.url).searchParams)
  validateClient(params, config)
  validateResource(params, config)
  const challenge = params.get("code_challenge") ?? ""
  const clientState = params.get("state") ?? ""
  if (params.get("response_type") !== "code" || params.get("redirect_uri") !== config.chatgptRedirectUri ||
      params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
      !clientState || clientState.length > 2048) fail()
  const state = oauthRandom()
  const nonce = oauthRandom()
  const verifier = oauthRandom()
  const transaction: OAuthTransaction = {
    clientId: config.chatgptClientId, redirectUri: config.chatgptRedirectUri,
    resource: config.resource, scopes: requestedScopes(params.get("scope")), clientState, challenge,
    verifier: encryptOAuth(verifier, config.tokenEncryptionKey, `transaction:${oauthHash(state)}`),
    nonceHash: oauthHash(nonce),
  }
  const fingerprint = createHmac("sha256", Buffer.from(config.tokenEncryptionKey, "base64"))
    .update(request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown").digest("hex")
  await oauthStore("create_transaction", oauthHash(state), { request: transaction, fingerprint })
  const upstream = new URL(`${config.issuer}/oauth/authorize`)
  upstream.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.upstreamRedirectUri, response_type: "code",
    scope: "openid email", state, code_challenge: oauthChallenge(verifier), code_challenge_method: "S256",
  }).toString()
  const response = NextResponse.redirect(upstream, 302)
  response.cookies.set(cookieName(state), nonce, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 })
  return response
}

async function pendingTransaction(state: string, nonce: string | undefined) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !nonce) return null
  const transaction = await oauthStore<OAuthTransaction | null>("read_transaction", oauthHash(state))
  if (!transaction || !oauthEqual(transaction.nonceHash, oauthHash(nonce))) return null
  return transaction
}

// Caller must already authenticate the browser user and obtain this URL directly
// from Supabase. The pending transaction itself predates user authentication.
export async function validateCompanionUpstreamRedirect(redirectUrl: string): Promise<boolean> {
  try {
    const config = getCompanionLiveConfig()
    const url = new URL(redirectUrl)
    const params = unique(url.searchParams)
    const state = params.get("state") ?? ""
    if (redirectUrl.length > 8192 || url.origin + url.pathname !== config.upstreamRedirectUri || url.hash || url.username || url.password ||
        (!!params.get("code") === !!params.get("error")) || (params.get("code")?.length ?? 0) > 4096 ||
        (params.has("iss") && params.get("iss") !== config.issuer)) return false
    const nonce = (await cookies()).get(cookieName(state))?.value
    const pending = await pendingTransaction(state, nonce)
    return !!pending && pending.clientId === config.chatgptClientId && pending.redirectUri === config.chatgptRedirectUri && pending.resource === config.resource
  } catch { return false }
}

async function upstreamTokens(config: Config, parameters: Record<string, string>): Promise<UpstreamSession> {
  const response = await fetch(`${config.issuer}/oauth/token`, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64")}` },
    body: new URLSearchParams(parameters),
  })
  if (!response.ok) fail("invalid_grant", 401)
  const body: unknown = await response.json()
  if (!body || typeof body !== "object") fail("invalid_grant", 401)
  const result = body as Record<string, unknown>
  if (typeof result.access_token !== "string" || result.access_token.length > 16384 ||
      typeof result.refresh_token !== "string" || result.refresh_token.length > 4096) fail("invalid_grant", 401)
  return { access_token: result.access_token, refresh_token: result.refresh_token, expires_at: 0 }
}

async function verifyUpstream(config: Config, upstream: UpstreamSession, expectedUser?: string) {
  const supabase = createClient<Database>(config.supabaseUrl, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${upstream.access_token}` } },
  })
  // getUser verifies the signature and current upstream user/session with Auth.
  // The supplementary claims below bind that verified token to our exact client.
  const { data, error } = await supabase.auth.getUser(upstream.access_token)
  if (error || !data.user || (expectedUser && data.user.id !== expectedUser)) fail("invalid_token", 401)
  let claims: Record<string, unknown>
  try { claims = JSON.parse(Buffer.from(upstream.access_token.split(".")[1], "base64url").toString("utf8")) }
  catch { fail("invalid_token", 401) }
  if (claims.iss !== config.issuer || claims.client_id !== config.clientId || claims.sub !== data.user.id ||
      claims.role !== "authenticated" || typeof claims.session_id !== "string" ||
      typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) fail("invalid_token", 401)
  assertCompanionAllowedUser(data.user.id)
  upstream.expires_at = claims.exp
  return { supabase, userId: data.user.id }
}

function clientRedirect(config: Config, transaction: OAuthTransaction, result: { code: string } | { error: string }) {
  const url = new URL(transaction.redirectUri)
  url.search = new URLSearchParams({ ...result, state: transaction.clientState, iss: config.publicOrigin }).toString()
  return NextResponse.redirect(url, 302)
}

async function callback(request: NextRequest, config: Config) {
  const params = unique(new URL(request.url).searchParams)
  const state = params.get("state") ?? ""
  if ((!!params.get("code") === !!params.get("error")) || (params.has("iss") && params.get("iss") !== config.issuer)) fail()
  const transaction = await pendingTransaction(state, request.cookies.get(cookieName(state))?.value)
  if (!transaction || transaction.clientId !== config.chatgptClientId || transaction.redirectUri !== config.chatgptRedirectUri || transaction.resource !== config.resource) fail()
  const consumed = await oauthStore<OAuthTransaction | null>("consume_transaction", oauthHash(state))
  if (!consumed) fail()
  let response: NextResponse
  if (params.has("error")) {
    response = clientRedirect(config, transaction, { error: "access_denied" })
  } else {
    const code = params.get("code") ?? ""
    if (!code || code.length > 4096) fail()
    const verifier = decryptOAuth<string>(transaction.verifier, config.tokenEncryptionKey, `transaction:${oauthHash(state)}`)
    const upstream = await upstreamTokens(config, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.upstreamRedirectUri })
    const { userId } = await verifyUpstream(config, upstream)
    const brokerCode = opaque("code")
    await oauthStore("create_grant", oauthHash(brokerCode), {
      userId, clientId: transaction.clientId, resource: transaction.resource, scopes: transaction.scopes,
      challenge: transaction.challenge, redirectUri: transaction.redirectUri,
      upstream: encryptOAuth(upstream, config.tokenEncryptionKey, `user:${userId}`),
    })
    response = clientRedirect(config, transaction, { code: brokerCode })
  }
  response.cookies.set(cookieName(state), "", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  return response
}

async function token(request: NextRequest, config: Config) {
  if (request.headers.has("authorization")) fail("invalid_client", 401)
  const params = await readForm(request)
  validateClient(params, config)
  validateResource(params, config)
  const accessToken = opaque("at")
  const refreshToken = opaque("rt")
  const payload: Record<string, unknown> = { clientId: config.chatgptClientId, resource: config.resource,
    accessHash: oauthHash(accessToken), refreshHash: oauthHash(refreshToken) }
  let grant: OAuthGrant | null
  if (params.get("grant_type") === "authorization_code") {
    const verifier = params.get("code_verifier") ?? ""
    const code = params.get("code") ?? ""
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !/^chc_code_[A-Za-z0-9_-]{43}$/.test(code) ||
        params.get("redirect_uri") !== config.chatgptRedirectUri) fail("invalid_grant")
    grant = await oauthStore<OAuthGrant | null>("exchange_code", oauthHash(code), {
      ...payload, redirectUri: config.chatgptRedirectUri, challenge: oauthChallenge(verifier),
    })
  } else if (params.get("grant_type") === "refresh_token") {
    const previous = params.get("refresh_token") ?? ""
    if (!/^chc_rt_[A-Za-z0-9_-]{43}$/.test(previous)) fail("invalid_grant")
    if (params.has("scope")) payload.scopes = requestedScopes(params.get("scope"), false)
    grant = await oauthStore<OAuthGrant | null>("rotate_refresh", oauthHash(previous), payload)
    if (grant) {
      try {
        assertCompanionAllowedUser(grant.userId)
        const prior = decryptOAuth<UpstreamSession>(grant.upstream, config.tokenEncryptionKey, `user:${grant.userId}`)
        const upstream = await upstreamTokens(config, { grant_type: "refresh_token", refresh_token: prior.refresh_token })
        await verifyUpstream(config, upstream, grant.userId)
        grant = await oauthStore<OAuthGrant | null>("save_upstream", grant.id, {
          rotation: grant.rotation, upstream: encryptOAuth(upstream, config.tokenEncryptionKey, `user:${grant.userId}`),
        })
      } catch {
        await oauthStore("revoke", oauthHash(accessToken), { clientId: config.chatgptClientId })
        fail("invalid_grant", 401)
      }
    }
  } else fail("unsupported_grant_type")
  if (!grant) fail("invalid_grant")
  try { assertCompanionAllowedUser(grant.userId) }
  catch (error) {
    await oauthStore("revoke", oauthHash(accessToken), { clientId: config.chatgptClientId })
    throw error
  }
  const upstream = decryptOAuth<UpstreamSession>(grant.upstream, config.tokenEncryptionKey, `user:${grant.userId}`)
  const lifetime = Math.min(900, Math.floor(upstream.expires_at - Date.now() / 1000 - 30))
  if (lifetime <= 0) {
    await oauthStore("revoke", oauthHash(accessToken), { clientId: config.chatgptClientId })
    fail("invalid_grant", 401)
  }
  return NextResponse.json({ access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: lifetime, scope: grant.scopes.join(" ") }, { headers: responseHeaders })
}

async function revoke(request: NextRequest, config: Config) {
  if (request.headers.has("authorization")) fail("invalid_client", 401)
  const params = await readForm(request)
  validateClient(params, config)
  const token = params.get("token") ?? ""
  if (!token || token.length > 4096) fail()
  const grant = await oauthStore<OAuthGrant | null>("revoke", oauthHash(token), { clientId: config.chatgptClientId })
  if (grant) {
    const upstream = decryptOAuth<UpstreamSession>(grant.upstream, config.tokenEncryptionKey, `user:${grant.userId}`)
    // Broker revocation already committed. Upstream cleanup cannot restore it.
    await createSupabaseAdminClient().auth.admin.signOut(upstream.access_token, "local").catch(() => undefined)
  }
  return new Response(null, { status: 200, headers: responseHeaders })
}

export async function handleCompanionOAuth(request: NextRequest, endpoint: "authorize" | "callback" | "token" | "revoke"): Promise<Response> {
  try {
    const config = getCompanionLiveConfig()
    const origin = request.headers.get("origin")
    if (new URL(request.url).origin !== config.publicOrigin || (origin && ![config.publicOrigin, "https://chatgpt.com"].includes(origin))) fail("invalid_request", 403)
    const expectedMethod = endpoint === "authorize" || endpoint === "callback" ? "GET" : "POST"
    if (request.method !== expectedMethod) return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: expectedMethod } })
    const response = endpoint === "authorize" ? await authorize(request, config) : endpoint === "callback" ? await callback(request, config) : endpoint === "token" ? await token(request, config) : await revoke(request, config)
    for (const [key, value] of Object.entries(responseHeaders)) response.headers.set(key, value)
    return response
  } catch (error) {
    const value = error as { code?: string; status?: number }
    return NextResponse.json({ error: value.code ?? "temporarily_unavailable", error_description: "Coach House connection unavailable. Reconnect or try again later." }, { status: value.status ?? 503, headers: responseHeaders })
  }
}

export async function authenticateCompanionConnection(request: Request) {
  const config = getCompanionLiveConfig()
  const match = /^Bearer (chc_at_[A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")
  if (!match) fail("invalid_token", 401)
  const grant = await oauthStore<OAuthGrant | null>("access", oauthHash(match[1]))
  if (!grant || grant.clientId !== config.chatgptClientId || grant.resource !== config.resource || !grant.scopes.includes("accelerator:read")) fail("invalid_token", 401)
  try { assertCompanionAllowedUser(grant.userId) }
  catch (error) {
    await oauthStore("revoke", oauthHash(match[1]), { clientId: config.chatgptClientId })
    throw error
  }
  const upstream = decryptOAuth<UpstreamSession>(grant.upstream, config.tokenEncryptionKey, `user:${grant.userId}`)
  const context = await verifyUpstream(config, upstream, grant.userId)
  return { ...context, clientId: config.clientId, connectionId: grant.id, scopes: grant.scopes, accessToken: upstream.access_token, appOrigin: config.publicOrigin }
}
