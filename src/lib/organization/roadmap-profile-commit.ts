import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase"

/** Visibility-only write; never replay a profile to change its audience. */
export async function commitRoadmapPublication(input: {
  organizationId: string; actorId: string; expectedUpdatedAt: string;
  isPublic: boolean; supportAccess: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const { data, error } = await createSupabaseAdminClient({ actorId: input.actorId, requestTimeoutMs: 15000 })
      .rpc("commit_roadmap_publication", {
        p_org: input.organizationId, p_expected_updated_at: input.expectedUpdatedAt,
        p_public: input.isPublic, p_support: input.supportAccess,
      })
    if (error?.code === "40001" || (!error && data === false))
      return { error: "This roadmap changed. Reload before changing sharing." }
    if (error?.code === "42501") return { error: "Roadmap access changed. Reload before changing sharing." }
    if (error || data !== true) return { error: "Unable to confirm this change. Reload before trying again." }
    return { ok: true }
  } catch {
    return { error: "Unable to confirm this change. Reload before trying again." }
  }
}

/** Called after session/access checks and canonical roadmap compilation.
 * No retry: the caller must reload after a conflict or an unknown result. */
export async function commitRoadmapProfile(input: {
  organizationId: string; actorId: string; expectedUpdatedAt: string | null;
  profile: Record<string, unknown>; supportAccess: boolean; requireStorage?: boolean;
}): Promise<{ ok: true } | { conflict: true } | { error: string }> {
  try {
    const { data, error } = await createSupabaseAdminClient({ actorId: input.actorId, requestTimeoutMs: 15000 })
      .rpc("commit_roadmap_profile", {
        p_org: input.organizationId, p_expected_updated_at: input.expectedUpdatedAt,
        p_profile: input.profile as Json, p_support: input.supportAccess,
        p_require_storage: input.requireStorage !== false,
      })
    if (error?.code === "40001" || (!error && data === false)) return { conflict: true }
    if (error?.code === "42501") return { error: "Document access changed. Reopen the document before saving." }
    if (error || data !== true) return { error: "Unable to confirm this save. Reload before trying again." }
    return { ok: true }
  } catch {
    return { error: "Unable to confirm this save. Reload before trying again." }
  }
}
