"use server"

import { filterDocumentFileAudience } from "@/lib/organization/document-file-audience"

import { projectAssetFolderContext } from "./project-asset-folder-context"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { applyFolderMutation, folderMutationSchema, parseProjectAssetFolderState, organizationFolderFiles, type FolderFile, type FolderMutation } from "../lib/project-asset-folders"
import { loadOrganizationDocuments } from "./organization-documents"
import { buildProjectAssetOpenPath } from "../lib/project-assets"


async function readFolders(actor: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>, projectId: string) {
  // Parent scope was checked above; elevated staff clients still need the
  // verified actor filter because service-role reads bypass folder RLS.
  const result = actor.isAdmin || actor.isPlatformStaff
    ? await createSupabaseAdminClient().rpc("read_project_asset_folders_for_actor", { p_project_id: projectId, p_actor_id: actor.userId })
    : await actor.supabase.rpc("read_project_asset_folders", { p_project_id: projectId })
  if (result.error) throw new Error("Unable to load folders. Try again.")
  return parseProjectAssetFolderState(result.data)
}

export async function loadProjectAssetFolders(projectId: string, actionScope: "workspace" | "platform" = "workspace") {
  try {
    const { actor, project, canEdit, fiscal } = await projectAssetFolderContext(projectId, true, actionScope)
    const isOrganization = !fiscal && project.project_kind === "organization_admin"
    const [assets, documents, organizationDocuments, state] = await Promise.all([
      actor.supabase.from("organization_project_assets").select("id, name")
        .eq("project_id", projectId).eq("org_id", project.org_id).order("created_at", { ascending: false }),
      isOrganization ? actor.supabase.from("organization_document_files").select("id, name")
        .eq("org_id", project.org_id).is("deleted_at", null).is("document_kind", null).order("name") : null,
      isOrganization && actorCanAccessOrganizations(actor) ? loadOrganizationDocuments(project.org_id) : null,
      readFolders(actor, projectId),
    ])
    if (assets.error || documents?.error) throw new Error("Unable to load files and folders. Try again.")
    if (organizationDocuments && "error" in organizationDocuments) throw new Error(organizationDocuments.error)
    const files: FolderFile[] = [
      ...(assets.data ?? []).map((file) => ({ key: `project:${file.id}`, name: file.name, source: "project" as const, url: buildProjectAssetOpenPath({ projectId, assetId: file.id }) })),
      ...(await filterDocumentFileAudience(documents?.data ?? [], actor.userId)).map((file) => ({ key: `organization:${file.id}`, name: file.name, source: "organization" as const, url: `/api/account/organization-document-files?${new URLSearchParams({ organizationId: project.org_id, id: file.id })}` })),
      ...(organizationDocuments ? organizationFolderFiles(organizationDocuments) : []),
    ]
    return { state, files, canEdit, organizationDocuments, organizationId: project.org_id, canUpload: fiscal || canEdit, canReviewAccess: !fiscal }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load folders." }
  }
}

export async function mutateProjectAssetFolder(projectId: string, input: FolderMutation, actionScope: "workspace" | "platform" = "workspace") {
  try {
    const parsed = folderMutationSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the folder details." }
    const change = parsed.data
    const { actor, project, canEdit } = await projectAssetFolderContext(projectId, false, actionScope)
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
    const newId = randomUUID()
    // Keep existing validation/copy, but persist a single command. Never replace
    // the library with a client-visible subset when folder audiences are added.
    applyFolderMutation(await readFolders(actor, projectId), change, newId)
    const result = await createSupabaseAdminClient().rpc("mutate_project_asset_folder", {
      p_project_id: projectId, p_org_id: project.org_id, p_actor_id: actor.userId,
      p_expected_updated_at: project.updated_at, p_change: change, p_new_id: newId,
    })
    if (result.error?.code === "40001") return { error: "The project changed. Refresh and try again." }
    if (result.error) return { error: "Unable to save folders. Try again." }
    const state = parseProjectAssetFolderState(result.data)
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/organizations/${projectId}`)
    return { state }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save folders." }
  }
}
