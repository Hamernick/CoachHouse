import { resolveWorkspaceProjectScope } from "@/lib/workspace/ordinary-project-access"
import { buildProjectAssetOpenPath } from "@/features/member-workspace"
import type { Database } from "@/lib/supabase"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ProjectAssetsRouteClient = ReturnType<
  typeof createSupabaseRouteHandlerClient
>
export type ProjectAssetsDataClient = SupabaseClient<Database>

export const PROJECT_ASSET_BUCKET = "project-assets"

export type ProjectRow = Pick<
  Database["public"]["Tables"]["organization_projects"]["Row"],
  "id" | "org_id"
>

export type AssetRow = Pick<
  Database["public"]["Tables"]["organization_project_assets"]["Row"],
  | "id"
  | "org_id"
  | "project_id"
  | "name"
  | "description"
  | "asset_type"
  | "storage_path"
  | "external_url"
  | "mime"
  | "size_bytes"
>

export async function cleanupProjectAssetCreation({
  assetIds,
  storagePaths,
  supabase,
}: {
  assetIds: string[]
  storagePaths: string[]
  supabase: ProjectAssetsRouteClient
}) {
  if (storagePaths.length) {
    try {
      await supabase.storage.from(PROJECT_ASSET_BUCKET).remove(storagePaths)
    } catch {
      // Continue the best-effort rollback.
    }
  }
  if (assetIds.length) {
    try {
      await supabase
        .from("organization_project_assets")
        .delete()
        .in("id", assetIds)
    } catch {
      // Rollback errors must not mask the original request failure.
    }
  }
}

export function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

const ALLOWED_FILE_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "fig",
  "figma",
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "json",
  "md",
  "mov",
  "mp3",
  "mp4",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "rtf",
  "svg",
  "txt",
  "wav",
  "webp",
  "xls",
  "xlsx",
  "zip",
])
const ALLOWED_MIME_TYPES = new Set([
  "application/json",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.figma",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "audio/mpeg",
  "audio/wav",
  "image/gif",
  "image/heic",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
  "video/mp4",
  "video/quicktime",
])
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"])
const PROJECT_ASSET_FILE_TYPE_HELP =
  "Upload PDF, Word, spreadsheet, image, media, CSV, ZIP, or Figma files only."

function getFileExtension(name: string) {
  const parts = name.toLowerCase().split(".")
  return parts.length > 1 ? (parts.pop() ?? "") : ""
}

export function getProjectAssetFileError(file: File) {
  const extension = getFileExtension(file.name)
  const mime = file.type.toLowerCase()
  const extensionAllowed = extension
    ? ALLOWED_FILE_EXTENSIONS.has(extension)
    : false
  const mimeAllowed =
    GENERIC_MIME_TYPES.has(mime) || ALLOWED_MIME_TYPES.has(mime)

  if (!extensionAllowed && !ALLOWED_MIME_TYPES.has(mime)) {
    return `${file.name} is not an allowed file type. ${PROJECT_ASSET_FILE_TYPE_HELP}`
  }

  if (extensionAllowed && !mimeAllowed) {
    return `${file.name} has an unsupported file type. ${PROJECT_ASSET_FILE_TYPE_HELP}`
  }

  return null
}

export function getProjectAssetLinkError(link: string) {
  try {
    const parsed = new URL(link)
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return null
    }
  } catch {
    return "Use a valid http or https asset link."
  }

  return "Use a valid http or https asset link."
}

export async function isPlatformAdmin({
  supabase,
  userId,
}: {
  supabase: ProjectAssetsRouteClient
  userId: string
}) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string | null }>()

  return data?.role === "admin"
}

export async function canAccessProjectOrg({
  projectId,
  orgId,
  requireEdit,
  supabase,
  userId,
}: {
  projectId: string
  orgId: string
  requireEdit: boolean
  supabase: ProjectAssetsRouteClient
  userId: string
}) {
  const scope = await resolveWorkspaceProjectScope({ supabase, userId, projectId })
  if (scope === "denied") return false
  if (scope === "fiscal") return !requireEdit
  const { data: staff, error: staffError } = await supabase
    .from("platform_staff_members")
    .select("access_level,can_access_unassigned_organizations,can_access_all_organizations")
    .eq("user_id", userId)
    .maybeSingle<{
      access_level: string
      can_access_unassigned_organizations: boolean
      can_access_all_organizations: boolean
    }>()

  const staffTableMissing =
    staffError?.code === "42P01" || staffError?.code === "PGRST205"
  if (staffError && !staffTableMissing) return false

  if (staff?.access_level === "coach") {
    if (staff.can_access_all_organizations === true) return true
    const { data: scope, error: scopeError } = await supabase
      .from("organization_coach_scope_settings")
      .select("assigned_only_enabled")
      .eq("id", true)
      .maybeSingle<{ assigned_only_enabled: boolean }>()

    if (scopeError?.code === "42P01" || scopeError?.code === "PGRST205")
      return true
    if (scopeError) return false
    if (!scope?.assigned_only_enabled) return true

    const { data: assignment, error: assignmentError } = await supabase
      .from("organization_coach_assignments")
      .select("organization_id")
      .eq("organization_id", orgId)
      .eq("coach_user_id", userId)
      .maybeSingle<{ organization_id: string }>()

    if (assignmentError) return false
    if (assignment) return true
    if (!staff.can_access_unassigned_organizations) return false
    const { data: anyAssignment, error: anyAssignmentError } = await supabase
      .from("organization_coach_assignments")
      .select("organization_id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle<{ organization_id: string }>()
    return !anyAssignmentError && !anyAssignment
  }

  if (staff?.access_level === "developer") {
    return true
  }

  if (await isPlatformAdmin({ supabase, userId })) {
    return true
  }

  if (orgId === userId) {
    return true
  }

  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("member_id", userId)
    .maybeSingle<{ role: string | null }>()

  if (!data) {
    return false
  }

  if (!requireEdit) {
    return true
  }

  return data.role === "owner" || data.role === "admin" || data.role === "staff"
}

export async function loadProject({
  projectId,
  supabase,
}: {
  projectId: string
  supabase: ProjectAssetsDataClient
}) {
  const { data, error } = await supabase
    .from("organization_projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export async function loadAsset({
  assetId,
  projectId,
  supabase,
}: {
  assetId: string
  projectId: string
  supabase: ProjectAssetsDataClient
}) {
  const { data, error } = await supabase
    .from("organization_project_assets")
    .select(
      "id, org_id, project_id, name, description, asset_type, storage_path, external_url, mime, size_bytes"
    )
    .eq("id", assetId)
    .eq("project_id", projectId)
    .maybeSingle<AssetRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export function assetResponse(asset: AssetRow) {
  return {
    id: asset.id,
    projectId: asset.project_id,
    name: asset.name,
    description: asset.description,
    assetType: asset.asset_type,
    externalUrl: asset.external_url,
    sizeBytes: asset.size_bytes,
    url:
      asset.external_url ||
      buildProjectAssetOpenPath({
        assetId: asset.id,
        projectId: asset.project_id,
      }),
  }
}
