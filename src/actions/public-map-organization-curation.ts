"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type PublicMapOrganizationCurationInput = {
  organizationId: string
  action: "hide" | "delete"
  reason?: string | null
}

type PublicMapOrganizationCurationResult =
  | { ok: true; id: string }
  | { error: string }

function formatPublicMapOrganizationCurationError(error: unknown) {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== "object") return String(error)

  const record = error as Record<string, unknown>
  const message = typeof record.message === "string" ? record.message : null
  const details = typeof record.details === "string" ? record.details : null
  return [message, details].filter(Boolean).join(" ") || "Unknown error"
}

function normalizeOrganizationId(value: string) {
  return value.trim()
}

function normalizeReason(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed.length > 0 ? trimmed : null
}

function normalizeAction(value: PublicMapOrganizationCurationInput["action"]) {
  if (value === "hide" || value === "delete") return value
  throw new Error("Unsupported organization action.")
}

function buildOrganizationAuditState(organization: {
  user_id: string
  public_slug: string | null
  is_public: boolean | null
}) {
  return {
    user_id: organization.user_id,
    public_slug: organization.public_slug,
    is_public: organization.is_public,
  }
}

function revalidatePublicMapOrganizationPaths(publicSlug: string | null) {
  revalidateTag("public-map-organizations", "max")
  revalidatePath("/map")
  revalidatePath("/resources")

  if (publicSlug) {
    revalidatePath(`/${publicSlug}`)
  }
}

export async function updatePublicMapOrganizationCurationAction(
  input: PublicMapOrganizationCurationInput
): Promise<PublicMapOrganizationCurationResult> {
  try {
    const { userId } = await requireAdmin()
    const organizationId = normalizeOrganizationId(input.organizationId)
    const action = normalizeAction(input.action)
    const reason =
      normalizeReason(input.reason) ??
      `${action === "delete" ? "Delete" : "Hide"} from /find organization profile.`
    if (!organizationId) {
      throw new Error("Organization is required.")
    }

    const admin = createSupabaseAdminClient()
    const { data: organization, error: loadError } = await admin
      .from("organizations")
      .select("user_id, public_slug, is_public")
      .eq("user_id", organizationId)
      .maybeSingle<{
        user_id: string
        public_slug: string | null
        is_public: boolean | null
      }>()

    if (loadError) throw loadError
    if (!organization) {
      throw new Error("Organization was not found.")
    }

    const { error: updateError } = await admin
      .from("organizations")
      .update({ is_public: false })
      .eq("user_id", organizationId)

    if (updateError) throw updateError

    const { error: auditError } = await admin
      .from("public_map_organization_curation_events")
      .insert({
        action,
        actor_id: userId,
        organization_id: organization.user_id,
        reason,
        before_state: buildOrganizationAuditState(organization),
        after_state: {
          ...buildOrganizationAuditState(organization),
          is_public: false,
        },
      })

    if (auditError) {
      console.warn(
        "[public-map-organization-curation] Unable to write curation event.",
        auditError
      )
    }

    revalidatePublicMapOrganizationPaths(organization.public_slug)
    return { ok: true, id: organization.user_id }
  } catch (error) {
    return { error: formatPublicMapOrganizationCurationError(error) }
  }
}
