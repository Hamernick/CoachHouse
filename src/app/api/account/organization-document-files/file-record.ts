import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { getCoreDocumentSectionId } from "@/lib/organization/core-document-uploads"

export type FileRow = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
  return cleaned.length > 0 ? cleaned : "file"
}

export function fileResponse(file: FileRow) {
  const coreSectionId = getCoreDocumentSectionId(file.storage_path)
  return {
    ...(coreSectionId ? { coreSectionId } : {}),
    id: file.id,
    name: file.name,
    mimeType: file.mime_type,
    sizeBytes: file.size_bytes,
    deletedAt: file.deleted_at,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  }
}

export async function loadFile(
  supabase: ReturnType<typeof createSupabaseRouteHandlerClient>,
  orgId: string,
  fileId: string
) {
  const result = await supabase
    .from("organization_document_files")
    .select(
      "id, name, mime_type, size_bytes, storage_path, deleted_at, created_at, updated_at"
    )
    .eq("id", fileId)
    .eq("org_id", orgId)
    .is("document_kind", null)
    .maybeSingle<FileRow>()
  if (
    result.data &&
    (!result.data.storage_path.startsWith(`${orgId}/library/`) ||
      result.data.storage_path.split("/").includes(".."))
  ) {
    return { ...result, data: null }
  }
  return result
}
