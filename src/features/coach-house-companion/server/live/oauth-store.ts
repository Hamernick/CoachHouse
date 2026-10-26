import { createSupabaseAdminClient } from "@/lib/supabase"
import { CompanionError } from "../errors"

export type OAuthTransaction = {
  clientId: string
  redirectUri: string
  resource: string
  scopes: string[]
  clientState: string
  challenge: string
  verifier: string
  nonceHash: string
}

export type UpstreamSession = { access_token: string; refresh_token: string; expires_at: number }

export type OAuthGrant = {
  id: string
  userId: string
  clientId: string
  resource: string
  scopes: string[]
  upstream: string
  rotation: number
}

type StoreValue = OAuthGrant | OAuthTransaction | { ok: true } | null

export async function oauthStore<T extends StoreValue>(action: string, key: string, payload: Record<string, unknown> = {}): Promise<T> {
  // One service-role-only RPC owns atomic code consumption, refresh rotation and
  // family revocation. Tokens and authorization codes are stored only as hashes.
  const client = createSupabaseAdminClient()
  const rpc = client.rpc.bind(client) as unknown as (
    name: string, args: Record<string, unknown>
  ) => Promise<{ data: T | { error: string }; error: { message: string } | null }>
  const { data, error } = await rpc("companion_oauth_store", { p_action: action, p_key: key, p_payload: payload })
  if (error) throw new CompanionError("temporarily_unavailable", 503, "Coach House connection storage is unavailable.")
  if (data && typeof data === "object" && "error" in data) {
    throw new CompanionError(data.error, data.error === "rate_limited" ? 429 : 400, "The connection request expired or is no longer valid. Connect Coach House again.")
  }
  return data as T
}
