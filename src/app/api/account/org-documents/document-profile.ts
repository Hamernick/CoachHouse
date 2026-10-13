import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import type { DocumentKey, DocumentMeta } from "./document-kinds"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export async function loadProfile(
  supabase: ReturnType<typeof createSupabaseRouteHandlerClient>,
  orgId: string
) {
  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()

  if (error) {
    throw new Error(error.message)
  }

  return (orgRow?.profile ?? {}) as Record<string, unknown>
}

export function updateDocumentsProfile(
  profile: Record<string, unknown>,
  key: DocumentKey,
  nextDoc: DocumentMeta | null
) {
  const documents = isRecord(profile["documents"])
    ? { ...profile["documents"] }
    : {}
  if (nextDoc) {
    documents[key] = nextDoc
  } else {
    delete documents[key]
  }
  return { ...profile, documents }
}
