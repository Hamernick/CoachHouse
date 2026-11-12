import "server-only"
import { z } from "zod"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS } from "@/lib/roadmap/public-organization-profile-sections"
import { omitDocumentProfileSections } from "@/lib/roadmap/document-profile-projection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const audienceSchema = z.strictObject({
  blockedSectionIds: z.array(z.string().min(1).max(120)).max(500),
  complete: z.literal(false),
})

/** Veto only: candidates must already satisfy publication and source rules.
 * null means the organization is no longer public; failures never return content.
 * Read on every request, including after caches. No owner identity is borrowed. */
export async function filterPublicDocumentSections<T extends { id: string }>(
  sections: T[], organizationId: string, audience: "profile" | "roadmap" = "roadmap",
): Promise<T[] | null> {
  const ids = [...new Set(sections.map(section => section.id))]
  const blocked = new Set<string>()
  const admin = createSupabaseAdminClient({ requestTimeoutMs: 10000 })
  // Even an empty roadmap needs current publication/closure admission.
  for (let offset = 0; offset < Math.max(ids.length, 1); offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const { data, error } = await admin.rpc("read_public_document_audience", {
      p_org_id: organizationId, p_section_ids: batch, p_audience: audience,
    })
    if (!error && data === null) return null
    const parsed = audienceSchema.safeParse(data)
    if (error || !parsed.success || parsed.data.blockedSectionIds.some(id => !batch.includes(id)) ||
      new Set(parsed.data.blockedSectionIds).size !== parsed.data.blockedSectionIds.length)
      throw new Error("Public document access could not be verified.")
    for (const id of parsed.data.blockedSectionIds) blocked.add(id)
  }
  return sections.filter(section => !blocked.has(section.id))
}

/** Shared by public map/profile and fallback community search.
 * Fresh admission after caches, before narrative-derived previews/search.
 * Batch organizations to avoid one network request per map result. */
export async function filterPublicOrganizationProfiles<T extends { user_id: string; profile: unknown }>(
  organizations: T[],
): Promise<T[]> {
  if (!organizations.length) return []
  const ids = [...new Set(organizations.map(row => row.user_id))]
  const sectionIds = [...PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS]
  const admitted = new Map<string, Set<string>>()
  const schema = z.array(audienceSchema.extend({ organizationId: z.string().uuid() })).max(500)
  const admin = createSupabaseAdminClient({ requestTimeoutMs: 10000 })
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500)
    const { data, error } = await admin.rpc("read_public_document_audiences", {
      p_org_ids: batch, p_section_ids: sectionIds, p_audience: "profile",
    })
    const parsed = schema.safeParse(data)
    if (error || !parsed.success || new Set(parsed.data.map(row => row.organizationId)).size !== parsed.data.length ||
      parsed.data.some(row => !batch.includes(row.organizationId) ||
        new Set(row.blockedSectionIds).size !== row.blockedSectionIds.length ||
        row.blockedSectionIds.some(id => !sectionIds.includes(id))))
      throw new Error("Public document access could not be verified.")
    for (const row of parsed.data) admitted.set(row.organizationId, new Set(row.blockedSectionIds))
  }
  return organizations.flatMap(row => {
    const blocked = admitted.get(row.user_id)
    if (!blocked) return []
    const profile = row.profile && typeof row.profile === "object" && !Array.isArray(row.profile)
      ? row.profile as Record<string, unknown> : {}
    const sections = resolveRoadmapSections(profile)
    return [{ ...row, profile: omitDocumentProfileSections(profile, sections, sections.filter(section => !blocked.has(section.id))) }]
  })
}
