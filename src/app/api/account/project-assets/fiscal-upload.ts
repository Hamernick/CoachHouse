import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"

import { sanitizeProjectAssetFilename } from "@/features/member-workspace"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveWorkspaceProjectScope } from "@/lib/workspace/ordinary-project-access"
import { assetResponse, type AssetRow, type ProjectAssetsRouteClient } from "./route-support"

const assetFields = "id, org_id, project_id, name, description, asset_type, storage_path, external_url, mime, size_bytes" as const

// Read access remains bound to the authenticated reviewer and this exact project.
// Related-record/storage RLS does not grant host-organization access to reviewers.
export async function projectAssetReadClient(supabase: ProjectAssetsRouteClient, userId: string, projectId: string) {
  const scope = await resolveWorkspaceProjectScope({ supabase, userId, projectId })
  return scope === "fiscal" ? createSupabaseAdminClient({ actorId: userId }) : supabase
}

export async function uploadFiscalReviewerAssets({
  actorId, projectId, uploadId, files, title, description, link,
}: {
  actorId: string
  projectId: string
  uploadId: string
  files: File[]
  title: string
  description: string | null
  link: string
}) {
  if (link || !files.length) return NextResponse.json({ error: "Choose files to upload for this application." }, { status: 400 })
  if (uploadId && !z.string().uuid().safeParse(uploadId).success) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 })
  const requestId = uploadId || randomUUID()
  const admin = createSupabaseAdminClient({ actorId })
  if (await resolveWorkspaceProjectScope({ supabase: admin, userId: actorId, projectId }) !== "fiscal") {
    return NextResponse.json({ error: "You no longer have access to this fiscal application." }, { status: 403 })
  }
  const { data: project, error } = await admin.from("organization_projects").select("id, org_id").eq("id", projectId).maybeSingle()
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 })
  const assets: AssetRow[] = []
  let pendingPath: string | null = null
  let pendingAssetId: string | null = null
  try {
    for (const [index, file] of files.entries()) {
      if (file.size === 0) throw new Error("Choose a file that is not empty.")
      const body = Buffer.from(await file.arrayBuffer())
      const digest = createHash("sha256").update(body).digest("hex")
      const key = createHash("sha256").update(`${actorId}:${projectId}:${requestId}:${index}`).digest("hex")
      const assetId = `${key.slice(0, 8)}-${key.slice(8, 12)}-4${key.slice(13, 16)}-a${key.slice(17, 20)}-${key.slice(20, 32)}`
      const filename = sanitizeProjectAssetFilename(file.name).replace(/\.{2,}/g, ".").slice(-180)
      const contentPrefix = `${project.org_id}/${project.id}/fiscal-uploads/${actorId}/${assetId}-${digest}-`
      const path = `${contentPrefix}${randomUUID()}-${filename}`
      const name = files.length === 1 && title ? title : file.name
      const { data: existing, error: existingError } = await admin.from("organization_project_assets")
        .select(`${assetFields}, created_by`).eq("id", assetId).maybeSingle()
      if (existingError) throw new Error("Unable to check this upload. Try again.")
      if (existing) {
        if (existing.org_id !== project.org_id || existing.project_id !== project.id || existing.created_by !== actorId || !existing.storage_path?.startsWith(contentPrefix) || existing.name !== name || existing.description !== description || existing.mime !== (file.type || null)) {
          throw new Error("This upload request was already used for a different file.")
        }
        assets.push(existing)
        continue
      }
      pendingAssetId = assetId
      pendingPath = path
      const uploaded = await admin.storage.from("project-assets").upload(path, body, { contentType: file.type || undefined })
      if (uploaded.error) throw new Error("Unable to upload this file. Try again.")
      const registered = await admin.rpc("register_fiscal_guest_project_asset", {
        p_actor_id: actorId, p_project_id: project.id, p_asset_id: assetId,
        p_filename: file.name, p_title: name, p_description: description,
        p_mime: file.type || null, p_size_bytes: file.size, p_storage_path: path,
      })
      const result = registered.data as { ok?: boolean; code?: string; created?: boolean } | null
      if (registered.error || result?.ok !== true) throw new Error(result?.code === "forbidden" ? "You no longer have access to this fiscal application." : "Unable to save this file. Try again.")
      if (result.created === false) await admin.storage.from("project-assets").remove([path])
      // A committed asset must never be removed even if its response/readback fails.
      pendingPath = null
      pendingAssetId = null
      const saved = await admin.from("organization_project_assets").select(assetFields).eq("id", assetId).eq("project_id", project.id).maybeSingle()
      if (saved.error || !saved.data) throw new Error("File saved, but it could not be refreshed. Reload the project.")
      assets.push(saved.data)
    }
    return NextResponse.json({ assets: assets.map(assetResponse) })
  } catch (cause) {
    if (pendingPath && pendingAssetId) {
      // A transport error can follow a successful transaction. Read back first.
      const saved = await admin.from("organization_project_assets").select("id, storage_path").eq("id", pendingAssetId).maybeSingle()
      if (!saved.error && saved.data?.storage_path !== pendingPath) await admin.storage.from("project-assets").remove([pendingPath])
    }
    const message = cause instanceof Error ? cause.message : "Unable to upload files. Try again."
    return NextResponse.json({ error: `${message}${assets.length ? " Earlier files are saved in this project's files." : ""}`, assets: assets.map(assetResponse) }, { status: 400 })
  }
}
