"use server"

import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import {
  actorCanAccessOrganization,
  actorCanAccessOrganizations,
} from "./member-workspace-actor-permissions"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { isDocumentsSectionVisible } from "@/lib/organization/core-document-uploads"
import { DOCUMENTS } from "@/lib/organization/core-document-definitions"
import type { DocumentsPolicyEntry } from "@/lib/organization/document-types"
import type { OrgDocuments } from "@/lib/organization/document-types"

export async function loadOrganizationDocuments(organizationId: string) {
  const actor = await resolveMemberWorkspaceActorContext()
  if (
    !actorCanAccessOrganizations(actor) ||
    !actorCanAccessOrganization(actor, organizationId)
  )
    return { error: "Forbidden" } as const
  const [organization, files, drive] = await Promise.all([
    actor.supabase
      .from("organizations")
      .select("profile, public_slug")
      .eq("user_id", organizationId)
      .maybeSingle(),
    actor.supabase
      .from("organization_document_files")
      .select("id, name, document_kind, updated_at")
      .eq("org_id", organizationId)
      .is("deleted_at", null)
      .is("document_kind", null)
      .order("name"),
    actor.supabase
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
    userId: actor.userId,
  }
}
