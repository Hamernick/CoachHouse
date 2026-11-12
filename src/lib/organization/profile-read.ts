import "server-only"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const rowSchema = z.object({
  user_id: z.string(), profile: z.record(z.string(), z.unknown()).nullable(),
  updated_at: z.string(), ein: z.string().nullable(), public_slug: z.string().nullable(),
  is_public: z.boolean().nullable(), location_lat: z.number().nullable(), location_lng: z.number().nullable(),
})
type ProfileRow = z.infer<typeof rowSchema>

/** Canonical server input ONLY. The caller must project document audiences before
 * returning any profile/section content. Never use a projected profile for CAS.
 * Only the explicit mixed-audience denial permits the actor-bound fallback;
 * missing rows, outages and other RLS failures retain their original meaning. */
export async function readOrganizationProfileForProjection(
  client: SupabaseClient<Database>, orgId: string, actorId: string, signal?: AbortSignal,
) {
  const query = client.from("organizations")
    .select("user_id,profile,updated_at,ein,public_slug,is_public,location_lat,location_lng")
    .eq("user_id", orgId)
  const result = await (signal ? query.abortSignal(signal) : query).maybeSingle<ProfileRow>()
  if (result.error?.code !== "42501" || result.error.message !== "Document audience projection required.") return result
  try {
    const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
    const fallback = await admin.rpc("read_organization_profile_for_projection", { p_org_id: orgId, p_actor_id: actorId })
    if (fallback.error) return { data: null, error: fallback.error }
    const parsed = rowSchema.safeParse(fallback.data)
    if (!parsed.success || parsed.data.user_id !== orgId) return { data: null, error: result.error }
    return { data: parsed.data, error: null }
  } catch { return { data: null, error: result.error } }
}
