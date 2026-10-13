"use server"

import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganization, actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { applyFolderMutation, folderMutationSchema, readProjectAssetFolders, organizationFolderFiles, type FolderFile, type FolderMutation } from "../lib/project-asset-folders"
import { loadOrganizationDocuments } from "./organization-documents"
import { mergeProjectOptions } from "../lib/project-fiscal-sponsorship"
import { buildProjectAssetOpenPath } from "../lib/project-assets"

async function context(projectId: string) {
  if (!z.string().uuid().safeParse(projectId).success) throw new Error("Choose a valid project.")
  const actor = await resolveMemberWorkspaceActorContext()
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) throw new Error("Use the fiscal application review for this project.")
  const access = ensureMemberWorkspaceFeatureAccess(actor)
  if (access) throw new Error(access.error)
  const result = await actor.supabase.from("organization_projects")
    .select("id, org_id, project_kind, updated_at, option_settings").eq("id", projectId).maybeSingle()
  if (result.error || !result.data || !actorCanAccessOrganization(actor, result.data.org_id)) {
    throw new Error("Unable to access that project.")
  }
  return { actor, project: result.data, canEdit: actorCanAccessOrganizations(actor) || actor.canEdit }
}

export async function loadProjectAssetFolders(projectId: string) {
  try {
    const { actor, project, canEdit } = await context(projectId)
    const isOrganization = project.project_kind === "organization_admin"
    const [assets, documents, organizationDocuments] = await Promise.all([
      actor.supabase.from("organization_project_assets").select("id, name")
        .eq("project_id", projectId).eq("org_id", project.org_id).order("created_at", { ascending: false }),
      isOrganization ? actor.supabase.from("organization_document_files").select("id, name")
        .eq("org_id", project.org_id).is("deleted_at", null).is("document_kind", null).order("name") : null,
      isOrganization && actorCanAccessOrganizations(actor) ? loadOrganizationDocuments(project.org_id) : null,
    ])
    if (assets.error || documents?.error) throw new Error("Unable to load files and folders. Try again.")
    if (organizationDocuments && "error" in organizationDocuments) throw new Error(organizationDocuments.error)
    const files: FolderFile[] = [
      ...(assets.data ?? []).map((file) => ({ key: `project:${file.id}`, name: file.name, source: "project" as const, url: buildProjectAssetOpenPath({ projectId, assetId: file.id }) })),
      ...(documents?.data ?? []).map((file) => ({ key: `organization:${file.id}`, name: file.name, source: "organization" as const, url: `/api/account/organization-document-files?${new URLSearchParams({ organizationId: project.org_id, id: file.id })}` })),
      ...(organizationDocuments ? organizationFolderFiles(organizationDocuments) : []),
    ]
    return { state: readProjectAssetFolders(project.option_settings), files, canEdit, organizationDocuments, organizationId: project.org_id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load folders." }
  }
}

export async function mutateProjectAssetFolder(projectId: string, input: FolderMutation) {
  try {
    const parsed = folderMutationSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the folder details." }
    const change = parsed.data
    const { actor, project, canEdit } = await context(projectId)
    if (!canEdit) return { error: "Only project editors can organize files." }
    if (change.type === "move") {
      const [source, id] = change.fileKey.split(":")
      if (project.project_kind !== "organization_admin" && source !== "project" && source !== "fiscal") {
        return { error: "Organization documents belong in the organization's files, not this project." }
      }
      if (["core", "policy", "upload", "drive"].includes(source)) {
        const documents = await loadOrganizationDocuments(project.org_id)
        if ("error" in documents || !organizationFolderFiles(documents).some((file) => file.key === change.fileKey)) {
          return { error: "That document is not available in this organization." }
        }
      } else {
        const result = source === "fiscal"
        ? await actor.supabase.from("fiscal_sponsorship_documents").select("id").eq("id", id).eq("project_id", projectId).eq("org_id", project.org_id).eq("status", "executed").maybeSingle()
        : source === "project"
        ? await actor.supabase.from("organization_project_assets").select("id").eq("id", id).eq("project_id", projectId).eq("org_id", project.org_id).maybeSingle()
        : await actor.supabase.from("organization_document_files").select("id").eq("id", id).eq("org_id", project.org_id).is("deleted_at", null).is("document_kind", null).maybeSingle()
        if (result.error || !result.data) return { error: "That file is not available in this project." }
      }
    }
    const state = applyFolderMutation(readProjectAssetFolders(project.option_settings), change, randomUUID())
    const result = await createSupabaseAdminClient().from("organization_projects")
      .update({ option_settings: mergeProjectOptions(project.option_settings, { assetFolders: state }), updated_by: actor.userId })
      .eq("id", projectId).eq("org_id", project.org_id).eq("updated_at", project.updated_at).select("id").maybeSingle()
    if (result.error) return { error: "Unable to save folders. Try again." }
    if (!result.data) return { error: "The project changed. Refresh and try again." }
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/organizations/${projectId}`)
    return { state }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save folders." }
  }
}
