import {
  KIND_KEY_MAP,
  type DocumentKey,
  type DocumentMeta,
} from "./document-kinds"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { validateOrganizationDocument } from "@/lib/organization/document-storage"
import { canEditOrganization } from "@/lib/organization/active-org"
import { mutateOrganizationProfile } from "@/lib/organization/profile-mutation"
import {
  notifyTrackedDocumentUpload,
  removeTrackedDocumentFile,
  renameTrackedDocumentFile,
  replaceTrackedDocumentFile,
  restoreTrackedDocumentFile,
  isTrackedDocumentPath,
  sanitizeTrackedDocumentFilename,
} from "./document-file-tracking"

const BUCKET = "org-documents"
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getDocumentKey(kind: string | null): DocumentKey | null {
  if (!kind) return null
  return KIND_KEY_MAP[kind as keyof typeof KIND_KEY_MAP] ?? null
}

async function loadProfile(
  supabase: ReturnType<typeof createSupabaseRouteHandlerClient>,
  orgId: string
) {
  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()

  if (error) {
    throw new Error(error.message)
  }

  return (orgRow?.profile ?? {}) as Record<string, unknown>
}

function updateDocumentsProfile(
  profile: Record<string, unknown>,
  key: DocumentKey,
  nextDoc: DocumentMeta | null
) {
  const documents = isRecord(profile["documents"])
    ? { ...profile["documents"] }
    : {}
  if (nextDoc) {
    documents[key] = nextDoc
  } else {
    delete documents[key]
  }
  return { ...profile, documents }
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

  const { searchParams } = new URL(request.url)
  const key = getDocumentKey(searchParams.get("kind"))
  const downloadRequested = searchParams.get("download") === "1"
  if (!key) {
    return NextResponse.json(
      { error: "Unsupported document kind" },
      { status: 400 }
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
    const { orgId } = access
    const profile = await loadProfile(supabase, orgId)
    const documents = isRecord(profile["documents"])
      ? (profile["documents"] as Record<string, unknown>)
      : {}
    const doc = documents[key]
    if (!isRecord(doc) || typeof doc.path !== "string") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    if (!isTrackedDocumentPath(doc.path, orgId, key)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(
        doc.path,
        60 * 15,
        downloadRequested
          ? {
              download:
                typeof doc.name === "string" && doc.name.length > 0
                  ? doc.name
                  : true,
            }
          : undefined
      )
    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message ?? "Unable to access document" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load document" },
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

  const { searchParams } = new URL(request.url)
  const key = getDocumentKey(searchParams.get("kind"))
  if (!key) {
    return NextResponse.json(
      { error: "Unsupported document kind" },
      { status: 400 }
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  const validationError = validateOrganizationDocument(file)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
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

    const safeName = sanitizeTrackedDocumentFilename(file.name)
    const objectName = `${orgId}/${key}/${Date.now()}-${safeName}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, buf, { contentType: file.type })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: quotaError, previousFile } =
      await replaceTrackedDocumentFile({
        supabase,
        orgId,
        documentKind: key,
        storagePath: objectName,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        userId: user.id,
      })
    if (quotaError) {
      await supabase.storage.from(BUCKET).remove([objectName])
      const quotaExceeded = quotaError.message.includes(
        "Organization document storage quota exceeded"
      )
      return NextResponse.json(
        {
          error: quotaExceeded
            ? "This upload exceeds the organization’s 5 GB document storage limit."
            : quotaError.message,
        },
        { status: quotaExceeded ? 413 : 500 }
      )
    }

    const doc: DocumentMeta = {
      name: file.name,
      path: objectName,
      size: file.size,
      mime: file.type,
      updatedAt: new Date().toISOString(),
    }

    const mutation = await mutateOrganizationProfile({
      supabase,
      orgId,
      mutate: (profile) => {
        const documents = isRecord(profile["documents"])
          ? (profile["documents"] as Record<string, unknown>)
          : {}
        const existing = documents[key]
        const existingPath =
          isRecord(existing) && typeof existing.path === "string"
            ? existing.path
            : null

        return {
          changed: true,
          nextProfile: updateDocumentsProfile(profile, key, doc),
          value: { existingPath },
        }
      },
    })

    if ("error" in mutation) {
      await restoreTrackedDocumentFile({
        supabase,
        orgId,
        documentKind: key,
        previousFile,
      })
      await supabase.storage.from(BUCKET).remove([objectName])
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    const { existingPath } = mutation.value
    if (
      existingPath &&
      existingPath !== objectName &&
      isTrackedDocumentPath(existingPath, orgId, key)
    ) {
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove([existingPath])
      if (cleanupError) {
        console.warn("Failed to remove replaced organization document")
      }
    }

    await notifyTrackedDocumentUpload({
      supabase,
      userId: user.id,
      documentKind: key,
      filename: file.name,
    })

    return NextResponse.json({ document: doc }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
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

  const { searchParams } = new URL(request.url)
  const key = getDocumentKey(searchParams.get("kind"))
  if (!key) {
    return NextResponse.json(
      { error: "Unsupported document kind" },
      { status: 400 }
    )
  }

  const payload = await request.json().catch(() => null)
  const nextName = typeof payload?.name === "string" ? payload.name.trim() : ""
  if (!nextName) {
    return NextResponse.json(
      { error: "Document title is required" },
      { status: 400 }
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
    if (!canEditOrganization(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const mutation = await mutateOrganizationProfile({
      supabase,
      orgId,
      mutate: (profile) => {
        const documents = isRecord(profile["documents"])
          ? (profile["documents"] as Record<string, unknown>)
          : {}
        const current = documents[key]
        if (!isRecord(current) || typeof current.path !== "string") {
          return { error: "Document not found", status: 404 }
        }
        if (!isTrackedDocumentPath(current.path, orgId, key)) {
          return { error: "Document not found", status: 404 }
        }

        const doc: DocumentMeta = {
          name: nextName,
          path: String(current.path),
          size: typeof current.size === "number" ? current.size : 0,
          mime:
            typeof current.mime === "string" ? current.mime : "application/pdf",
          updatedAt: new Date().toISOString(),
        }

        return {
          changed: true,
          nextProfile: updateDocumentsProfile(profile, key, doc),
          value: doc,
        }
      },
    })

    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    await renameTrackedDocumentFile({
      supabase,
      orgId,
      documentKind: key,
      name: nextName,
    })

    return NextResponse.json({ document: mutation.value }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
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

  const { searchParams } = new URL(request.url)
  const key = getDocumentKey(searchParams.get("kind"))
  if (!key) {
    return NextResponse.json(
      { error: "Unsupported document kind" },
      { status: 400 }
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
    if (!canEditOrganization(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const mutation = await mutateOrganizationProfile({
      supabase,
      orgId,
      mutate: (profile) => {
        const documents = isRecord(profile["documents"])
          ? (profile["documents"] as Record<string, unknown>)
          : {}
        const current = documents[key]
        const path =
          isRecord(current) && typeof current.path === "string"
            ? current.path
            : null

        return {
          changed: Boolean(current),
          nextProfile: updateDocumentsProfile(profile, key, null),
          value: { path },
        }
      },
    })

    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    const { path } = mutation.value
    if (path && isTrackedDocumentPath(path, orgId, key)) {
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove([path])
      if (cleanupError) {
        console.warn("Failed to remove deleted organization document")
      } else {
        await removeTrackedDocumentFile({
          supabase,
          orgId,
          documentKind: key,
        })
      }
    } else {
      await removeTrackedDocumentFile({
        supabase,
        orgId,
        documentKind: key,
      })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    )
  }
}
