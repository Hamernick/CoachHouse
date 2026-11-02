import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type SignedResult = { data: { signedUrl: string } | null; error: { message: string } | null }

async function deadline(orgId: string, ttl: number) {
  const client = createSupabaseAdminClient({ requestTimeoutMs: 10000 })
  const rpc = client.rpc.bind(client) as unknown as (name: string, args: { p_org: string; p_ttl: number }) => PromiseLike<{ data: unknown; error: unknown }>
  const { data, error } = await rpc("organization_storage_link_deadline", { p_org: orgId, p_ttl: ttl })
  if (error || !data || typeof data !== "object") throw new Error("This download is no longer available.")
  const row = data as { serverNow?: unknown; expiresAt?: unknown }
  const now = typeof row.serverNow === "string" ? Date.parse(row.serverNow) : NaN
  const until = typeof row.expiresAt === "string" ? Date.parse(row.expiresAt) : NaN
  if (!Number.isFinite(now) || !Number.isFinite(until) || until <= now) throw new Error("This download is no longer available.")
  return { now, until }
}

/** The Storage token remains a bearer credential. Bound newly issued links to
 * the fixed export deadline, then discard late signing/revocation responses.
 * Token decoding only rejects unsafe expiry; it never establishes authority. */
export async function createPrivateOrganizationLink({ orgId, ttl, sign, revalidate }: {
  orgId: string
  ttl: number
  sign: (seconds: number) => PromiseLike<SignedResult>
  revalidate: () => Promise<boolean>
}): Promise<SignedResult> {
  try {
    const admitted = await deadline(orgId, ttl)
    // Allow provider clock rounding; the returned token's actual expiry is also checked.
    const seconds = Math.min(ttl, Math.floor((admitted.until - admitted.now) / 1000) - 1)
    if (seconds < 1) throw new Error("This download is no longer available.")
    const signed = await sign(seconds)
    if (signed.error || !signed.data?.signedUrl) return signed
    const token = new URL(signed.data.signedUrl).searchParams.get("token")
    const payload = token?.split(".")[1]
    if (!payload) throw new Error("Unable to verify download expiry.")
    const expiry = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown }).exp
    if (typeof expiry !== "number" || !Number.isFinite(expiry) || expiry * 1000 > admitted.until)
      throw new Error("Unable to verify download expiry.")
    if (!await revalidate()) throw new Error("This download is no longer available.")
    const current = await deadline(orgId, ttl)
    if (expiry * 1000 <= current.now || expiry * 1000 > current.until)
      throw new Error("This download is no longer available.")
    return signed
  } catch {
    return { data: null, error: { message: "This download is no longer available." } }
  }
}
