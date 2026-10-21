import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { organizationBrandIdentitySchema, readOrganizationBrandIdentity, type OrganizationBrandIdentity } from "./brand-identity-schema"

/** Validate references in the same authorized organization before the profile CAS. */
export async function prepareOrganizationBrandIdentitySave({
  supabase, orgId, incoming,
}: {
  supabase: SupabaseClient<Database>
  orgId: string
  incoming?: OrganizationBrandIdentity
}): Promise<{ value?: OrganizationBrandIdentity } | { error: string }> {
  if (incoming === undefined) return {}
  const parsed = organizationBrandIdentitySchema.safeParse(incoming)
  if (!parsed.success) return { error: "The brand kit contains invalid data." }
  const { data: record, error: readError } = await supabase.from("organization_brand_kits")
    .select("identity").eq("org_id", orgId).maybeSingle()
  if (readError) return { error: "Brand kit saving is temporarily unavailable. Your edits have been kept." }
  const saved = readOrganizationBrandIdentity(record?.identity)
  if ((saved?.revision ?? null) !== parsed.data.revision) {
    return { error: "This brand kit was updated elsewhere. Reload before saving." }
  }
  const assets = { ...parsed.data.assets }
  const ids = [...new Set(Object.values(assets).flatMap(asset => asset ? [asset.fileId] : []))]
  if (ids.length) {
    const { data: files, error } = await supabase.from("organization_document_files")
      .select("id, name, mime_type, size_bytes, updated_at, storage_path")
      .eq("org_id", orgId).in("id", ids).is("deleted_at", null).is("document_kind", null)
    if (error) return { error: "Unable to verify brand files. Try saving again." }
    for (const [slot, asset] of Object.entries(assets)) {
      if (!asset) continue
      const file = files?.find(file => file.id === asset.fileId)
      if (!file || (!file.storage_path.startsWith(`${orgId}/library/`) || file.storage_path.split("/").includes(".."))) {
        return { error: "A brand file is unavailable. Restore it in Documents or replace it before saving." }
      }
      assets[slot as keyof typeof assets] = {
        fileId: file.id, name: file.name, type: file.mime_type as typeof asset.type,
        size: file.size_bytes, updatedAt: file.updated_at,
      }
    }
  }
  const canonical = organizationBrandIdentitySchema.safeParse({
    ...parsed.data, revision: randomUUID(), assets,
    draft: { ...parsed.data.draft, updatedAt: new Date().toISOString() },
  })
  return canonical.success ? { value: canonical.data } : { error: "Brand files must be PNG, JPEG, WebP, or SVG images up to 12 MB." }
}

export function matchesBrandOrganizationContext(payload: { expectedOrganizationId?: string; brandIdentity?: OrganizationBrandIdentity }, orgId: string) {
  if (payload.expectedOrganizationId && payload.expectedOrganizationId !== orgId) return false
  return !payload.brandIdentity || payload.expectedOrganizationId === orgId
}

export async function loadOrganizationBrandIdentity(supabase: SupabaseClient<Database>, orgId: string) {
  const { data, error } = await supabase.from("organization_brand_kits").select("identity").eq("org_id", orgId).maybeSingle()
  if (error) {
    // The development UI remains usable before its additive migration ships.
    if (error.code === "42P01" || error.code === "PGRST205") return undefined
    throw new Error("Unable to load the organization's brand kit.")
  }
  return readOrganizationBrandIdentity(data?.identity)
}

export async function saveProfileWithBrandIdentity({ supabase, orgId, expectedUpdatedAt, expectedRevision, identity, profilePatch }: {
  supabase: SupabaseClient<Database>; orgId: string; expectedUpdatedAt: string | undefined;
  expectedRevision: string | null; identity: OrganizationBrandIdentity; profilePatch: Database["public"]["Tables"]["organizations"]["Update"]
}): Promise<{ error: string } | { ok: true }> {
  if (!expectedUpdatedAt) return { error: "Save the organization before creating its brand kit." }
  const { error, data } = await supabase.rpc("save_organization_profile_with_brand_kit", {
    p_org_id: orgId, p_expected_updated_at: expectedUpdatedAt, p_expected_brand_revision: expectedRevision,
    p_identity: identity, p_profile_patch: JSON.parse(JSON.stringify(profilePatch)),
  })
  return error || !data ? { error: error?.message ?? "Unable to save the brand kit." } : { ok: true }
}
