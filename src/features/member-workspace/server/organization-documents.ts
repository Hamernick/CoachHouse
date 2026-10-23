"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { isDocumentsSectionVisible } from "@/lib/organization/core-document-uploads"
import { DOCUMENTS } from "@/lib/organization/core-document-definitions"
import type { DocumentsPolicyEntry } from "@/lib/organization/document-types"
import type { OrgDocuments } from "@/lib/organization/document-types"

export async function loadOrganizationDocuments(organizationId: string) {
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return { error: "Sign in to access documents." } as const
  const access = await resolveOrganizationDocumentAccess(client, user.id, organizationId)
  if ("error" in access) return { error: "Document access denied." } as const
  const [organization, files, drive] = await Promise.all([
    access.supabase
      .from("organizations")
      .select("profile, public_slug")
      .eq("user_id", organizationId)
      .maybeSingle(),
    access.supabase
      .from("organization_document_files")
      .select("id, name, document_kind, updated_at")
      .eq("org_id", organizationId)
      .is("deleted_at", null)
      .is("document_kind", null)
      .order("name"),
    access.supabase
      .from("organization_external_documents")
      .select("id, name, web_view_link, status")
      .eq("org_id", organizationId)
      .order("name"),
  ])
  if (organization.error || files.error || drive.error)
    return {
      error: "Unable to load organization documents. Try again.",
    } as const
  if (!organization.data) return { error: "Organization not found." } as const
  const profile = (organization.data.profile ?? {}) as Record<string, unknown>
  const documents = (profile.documents ?? {}) as OrgDocuments
  return {
    policies: (Array.isArray(profile.policies)
      ? profile.policies
      : []) as DocumentsPolicyEntry[],
    sections: resolveRoadmapSections(profile).filter((section) =>
      isDocumentsSectionVisible(section.id)
    ),
    uploads: DOCUMENTS.map((definition) => ({
      kind: definition.kind,
      title: definition.title,
      document: documents[definition.key] ?? null,
    })),
    files: files.data ?? [],
    drive: drive.data ?? [],
    userId: user.id,
  }
}
