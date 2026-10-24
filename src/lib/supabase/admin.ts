import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { env } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

// actorId must come from server-verified authentication, never request payloads.
// Each client carries its own audit context; no shared headers are mutated.
export function createSupabaseAdminClient(
  { actorId, requestTimeoutMs }: { actorId?: string; requestTimeoutMs?: number } = {},
): SupabaseClient<Database, "public"> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations")
  }

  if (requestTimeoutMs !== undefined && (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000))
    throw new Error("Admin request timeout must be between 1 and 30000ms")
  const boundedFetch: typeof fetch = (input, init) => {
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    return fetch(input, { ...init, signal: AbortSignal.any([
      ...(inherited ? [inherited] : []), AbortSignal.timeout(requestTimeoutMs ?? 15000),
    ]) })
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    ...(actorId || requestTimeoutMs ? { global: {
      ...(actorId ? { headers: { "x-coach-house-actor-id": actorId } } : {}),
      ...(requestTimeoutMs ? { fetch: boundedFetch } : {}),
    } } : {}),
    auth: {
      persistSession: false,
    },
  })
}
