import { CompanionError } from "../errors"

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new CompanionError("configuration_required", 503, "Coach House connection is not configured.")
  return value
}

function secureUrl(value: string, originOnly = false) {
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (originOnly && url.pathname !== "/")) {
    throw new CompanionError("configuration_required", 503, "Coach House connection requires canonical HTTPS URLs.")
  }
  return originOnly ? url.origin : url.href.replace(/\/$/, "")
}

export function getCompanionLiveConfig() {
  if (process.env.COMPANION_LIVE_ENABLED !== "1") {
    throw new CompanionError("disabled", 404, "Coach House connection is not enabled.")
  }
  if (process.env.COMPANION_SANDBOX_ENABLED === "1") {
    throw new CompanionError("configuration_required", 503, "Choose either a connected Coach House environment or a sandbox.")
  }
  const publicOrigin = secureUrl(required("COMPANION_PUBLIC_ORIGIN"), true)
  const supabaseUrl = secureUrl(required("NEXT_PUBLIC_SUPABASE_URL"), true)
  const clientId = required("COMPANION_OAUTH_CLIENT_ID")
  const tokenEncryptionKey = required("COMPANION_TOKEN_ENCRYPTION_KEY")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) ||
      !/^[A-Za-z0-9+/]{43}=$/.test(tokenEncryptionKey) || Buffer.from(tokenEncryptionKey, "base64").length !== 32) {
    throw new CompanionError("configuration_required", 503, "Coach House connection credentials are invalid.")
  }
  const chatgptRedirectUri = secureUrl(required("COMPANION_CHATGPT_REDIRECT_URI"))
  const redirect = new URL(chatgptRedirectUri)
  if (redirect.origin !== "https://chatgpt.com" ||
      !(/^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(redirect.pathname) || redirect.pathname === "/connector_platform_oauth_redirect")) {
    throw new CompanionError("configuration_required", 503, "Use the exact ChatGPT OAuth callback URL from the plugin connection.")
  }
  return {
    publicOrigin,
    resource: `${publicOrigin}/api/companion/mcp`,
    issuer: `${supabaseUrl}/auth/v1`,
    supabaseUrl,
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    clientId,
    clientSecret: required("COMPANION_SUPABASE_CLIENT_SECRET"),
    chatgptClientId: required("COMPANION_CHATGPT_CLIENT_ID"),
    chatgptRedirectUri,
    upstreamRedirectUri: `${publicOrigin}/api/companion/oauth/callback`,
    tokenEncryptionKey,
  }
}

export const COMPANION_SCOPES = ["accelerator:read", "accelerator:write"] as const

export function companionOAuthMetadata() {
  const { publicOrigin } = getCompanionLiveConfig()
  return {
    issuer: publicOrigin,
    authorization_endpoint: `${publicOrigin}/api/companion/oauth/authorize`,
    token_endpoint: `${publicOrigin}/api/companion/oauth/token`,
    revocation_endpoint: `${publicOrigin}/api/companion/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...COMPANION_SCOPES],
    authorization_response_iss_parameter_supported: true,
  }
}

export function companionResourceMetadata() {
  const { resource, publicOrigin } = getCompanionLiveConfig()
  return {
    resource,
    authorization_servers: [publicOrigin],
    scopes_supported: [...COMPANION_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Coach House Accelerator",
  }
}
