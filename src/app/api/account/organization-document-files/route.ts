import { purgeExpiredFiles } from "./file-cleanup"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { randomUUID } from "node:crypto"

import { NextResponse, type NextRequest } from "next/server"

import { createNotification } from "@/lib/notifications"
import { isCoreDocumentSectionId } from "@/lib/organization/core-document-uploads"
import {
  MAX_BYTES,
  MAX_UPLOAD_MB,
  ORGANIZATION_DOCUMENT_QUOTA_BYTES as QUOTA_BYTES,
} from "@/lib/organization/document-storage"
import { canEditOrganization } from "@/lib/organization/active-org"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

import { fileResponse, sanitizeFilename, type FileRow } from "./file-record"

const BUCKET = "org-documents"
const SIGNED_URL_TTL_SECONDS = 60 * 15

async function loadFile(
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

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const access = await resolveOrganizationDocumentAccess(
      supabase,
      user.id,
      request.nextUrl.searchParams.get("organizationId")
    )
    if ("error" in access)
      return NextResponse.json({ error: access.error }, { status: 403 })
    supabase = access.supabase
    const { orgId, role } = access
    const fileId = request.nextUrl.searchParams.get("id")?.trim()

    if (fileId) {
      const { data, error: fileError } = await loadFile(supabase, orgId, fileId)

      if (fileError) {
        return NextResponse.json({ error: fileError.message }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: "File not found." }, { status: 404 })
      }
      if (data.deleted_at) {
        return NextResponse.json(
          { error: "Restore this file before opening it." },
          { status: 409 }
        )
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          data.storage_path,
          SIGNED_URL_TTL_SECONDS,
          request.nextUrl.searchParams.get("download") === "true"
            ? { download: data.name || true }
            : undefined
        )

      if (signedError || !signed?.signedUrl) {
        return NextResponse.json(
          { error: signedError?.message ?? "Unable to open file." },
          { status: 500 }
        )
      }

      return NextResponse.json({ url: signed.signedUrl }, { status: 200 })
    }

    if (canEditOrganization(role)) {
      await purgeExpiredFiles(supabase, orgId)
    }

    const [
      { data: files, error: filesError },
      { data: usage, error: usageError },
    ] = await Promise.all([
      supabase
        .from("organization_document_files")
        .select(
          "id, name, mime_type, size_bytes, storage_path, deleted_at, created_at, updated_at"
        )
        .eq("org_id", orgId)
        .is("document_kind", null)
        .order("created_at", { ascending: false })
        .returns<FileRow[]>(),
      supabase
        .from("organization_document_files")
        .select("size_bytes")
        .eq("org_id", orgId)
        .returns<Array<{ size_bytes: number }>>(),
    ])

    if (filesError || usageError) {
      return NextResponse.json(
        {
          error:
            filesError?.message ??
            usageError?.message ??
            "Unable to load files.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        files: (files ?? []).map(fileResponse),
        quota: {
          usedBytes: (usage ?? []).reduce(
            (total, file) => total + file.size_bytes,
            0
          ),
          limitBytes: QUOTA_BYTES,
        },
      },
      { status: 200 }
    )
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to load files.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  const coreSectionId = form.get("coreSectionId")
  if (coreSectionId !== null && !isCoreDocumentSectionId(coreSectionId)) {
    return NextResponse.json(
      { error: "Unsupported core document." },
      { status: 400 }
    )
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "Empty files cannot be uploaded." },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` },
      { status: 400 }
    )
  }
  if (file.name.length > 1024) {
    return NextResponse.json(
      { error: "File name is too long." },
      { status: 400 }
    )
  }

  let uploadedPath: string | null = null
  try {
    const access = await resolveOrganizationDocumentAccess(
      supabase,
      user.id,
      request.nextUrl.searchParams.get("organizationId")
    )
    if ("error" in access)
      return NextResponse.json({ error: access.error }, { status: 403 })
    supabase = access.supabase
    const { orgId, role } = access
    if (!canEditOrganization(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await purgeExpiredFiles(supabase, orgId)

    const folder = coreSectionId ? `core/${coreSectionId}/` : ""
    const objectName = `${orgId}/library/${folder}${randomUUID()}-${sanitizeFilename(file.name)}`
    const mimeType = file.type || "application/octet-stream"
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, buffer, { contentType: mimeType })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }
    uploadedPath = objectName

    const { data, error: insertError } = await supabase
      .from("organization_document_files")
      .insert({
        org_id: orgId,
        document_kind: null,
        storage_path: objectName,
        name: file.name,
        mime_type: mimeType,
        size_bytes: file.size,
        created_by: user.id,
      })
      .select(
        "id, name, mime_type, size_bytes, storage_path, deleted_at, created_at, updated_at"
      )
      .single<FileRow>()

    if (insertError || !data) {
      await supabase.storage.from(BUCKET).remove([objectName])
      const quotaExceeded = insertError?.message.includes(
        "Organization document storage quota exceeded"
      )
      return NextResponse.json(
        {
          error: quotaExceeded
            ? "This upload exceeds the organization’s 5 GB document storage limit."
            : (insertError?.message ?? "Unable to save file."),
        },
        { status: quotaExceeded ? 413 : 500 }
      )
    }

    // Metadata now owns this object. Notification failures must never roll it back.
    uploadedPath = null
    const notifyResult = await createNotification(supabase, {
      userId: user.id,
      title: "File uploaded",
      description: `${file.name} added to Documents.`,
      href: "/organization/documents",
      tone: "success",
      type: "document_uploaded",
      actorId: user.id,
      metadata: { fileId: data.id, filename: file.name },
    }).catch(() => ({ error: "Unable to create upload notification" }))
    if ("error" in notifyResult) {
      console.error(
        "Failed to create document notification",
        notifyResult.error
      )
    }

    return NextResponse.json({ file: fileResponse(data) }, { status: 200 })
  } catch (routeError: unknown) {
    if (uploadedPath) {
      await supabase.storage
        .from(BUCKET)
        .remove([uploadedPath])
        .catch(() => undefined)
    }
    return NextResponse.json(
      {
        error:
          routeError instanceof Error ? routeError.message : "Upload failed.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const fileId = typeof payload?.id === "string" ? payload.id.trim() : ""
  const action =
    payload?.action === "trash" || payload?.action === "restore"
      ? payload.action
      : null
  if (!fileId || !action) {
    return NextResponse.json({ error: "Invalid file action." }, { status: 400 })
  }

  try {
    const access = await resolveOrganizationDocumentAccess(
      supabase,
      user.id,
      request.nextUrl.searchParams.get("organizationId")
    )
    if ("error" in access)
      return NextResponse.json({ error: access.error }, { status: 403 })
    supabase = access.supabase
    const { orgId, role } = access
    if (!canEditOrganization(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: current, error: fileError } = await loadFile(
      supabase,
      orgId,
      fileId
    )
    if (fileError) {
      return NextResponse.json({ error: fileError.message }, { status: 500 })
    }
    if (!current) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const { data, error: updateError } = await supabase
      .from("organization_document_files")
      .update({
        deleted_at:
          action === "trash"
            ? (current.deleted_at ?? new Date().toISOString())
            : null,
      })
      .eq("id", current.id)
      .eq("org_id", orgId)
      .select(
        "id, name, mime_type, size_bytes, storage_path, deleted_at, created_at, updated_at"
      )
      .single<FileRow>()

    if (updateError || !data) {
      return NextResponse.json(
        { error: updateError?.message ?? "Unable to update file." },
        { status: 500 }
      )
    }

    return NextResponse.json({ file: fileResponse(data) }, { status: 200 })
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to update file.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const fileId = typeof payload?.id === "string" ? payload.id.trim() : ""
  if (!fileId) {
    return NextResponse.json({ error: "File is required." }, { status: 400 })
  }

  try {
    const access = await resolveOrganizationDocumentAccess(
      supabase,
      user.id,
      request.nextUrl.searchParams.get("organizationId")
    )
    if ("error" in access)
      return NextResponse.json({ error: access.error }, { status: 403 })
    supabase = access.supabase
    const { orgId, role } = access
    if (!canEditOrganization(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: current, error: fileError } = await loadFile(
      supabase,
      orgId,
      fileId
    )
    if (fileError) {
      return NextResponse.json({ error: fileError.message }, { status: 500 })
    }
    if (!current) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }
    if (!current.deleted_at) {
      return NextResponse.json(
        { error: "Move the file to Recently Deleted first." },
        { status: 409 }
      )
    }

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([current.storage_path])
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    const { error: deleteError } = await supabase
      .from("organization_document_files")
      .delete()
      .eq("id", current.id)
      .eq("org_id", orgId)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to permanently delete file.",
      },
      { status: 500 }
    )
  }
}
