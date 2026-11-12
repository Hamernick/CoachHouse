import { reconcileLegacyDocumentCleanup } from "@/lib/organization/legacy-document-cleanup"
import { reconcileLegacyDocumentUploadStages, uploadLegacyDocumentStage, type LegacyDocumentUploadStage } from "@/lib/organization/legacy-document-upload-stage"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { randomUUID } from "node:crypto"
import { readableLegacyDocumentBindings } from "@/lib/organization/legacy-document-bindings"
import { PRIVATE_FILE_HEADERS, privateFileContentUrl, privateStorageResponse } from "@/lib/organization/private-storage-response"
import { loadProfile, updateDocumentsProfile } from "./document-profile"
import { requireOrganizationDocumentStorage } from "@/lib/organization/document-storage-access"
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
    const binding = (await readableLegacyDocumentBindings([{ kind: key, path: doc.path }], orgId, user.id)).get(key)
    if (!binding) return NextResponse.json({ error: "Document not found" }, { status: 404, headers: PRIVATE_FILE_HEADERS })

    if (searchParams.get("content") !== "1") {
      const url = privateFileContentUrl("/api/account/org-documents", {
        organizationId: orgId, kind: searchParams.get("kind")!, ...(downloadRequested ? { download: "1" } : {}),
      })
      return NextResponse.json({ url }, { headers: PRIVATE_FILE_HEADERS })
    }
    return privateStorageResponse({
      request, orgId, name: typeof doc.name === "string" ? doc.name : "document.pdf",
      mime: typeof doc.mime === "string" ? doc.mime : "application/pdf", maxBytes: 15 * 1024 * 1024,
      download: downloadRequested,
      sign: seconds => createSupabaseAdminClient({ requestTimeoutMs: 10000 }).storage.from(BUCKET).createSignedUrl(doc.path as string, seconds),
      revalidate: async () => {
        const currentAccess = await resolveOrganizationDocumentAccess(supabase, user.id, orgId)
        if ("error" in currentAccess) return false
        const current = await loadProfile(currentAccess.supabase, orgId)
        const documents = isRecord(current.documents) ? current.documents : {}
        if (!isRecord(documents[key]) || documents[key].path !== doc.path || documents[key].updatedAt !== doc.updatedAt) return false
        const currentBinding = (await readableLegacyDocumentBindings([{ kind: key, path: doc.path as string }], orgId, user.id)).get(key)
        return currentBinding?.id === binding.id
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load document" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const attemptedPaths = new Set<string>()
  let stage: LegacyDocumentUploadStage | undefined
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
    const storageAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
    if ("error" in storageAccess) {
      return NextResponse.json({ error: storageAccess.error }, { status: 403 })
    }

    await reconcileLegacyDocumentCleanup({ orgId, documentKind: null, actorId: user.id, attemptedPaths, support: "supportAccess" in access && access.supportAccess === true })

    const safeName = sanitizeTrackedDocumentFilename(file.name)
    const objectName = `${orgId}/${key}/${randomUUID()}-${safeName}`
    const buf = Buffer.from(await file.arrayBuffer())
    stage = { orgId, documentKind: key, actorId: user.id, path: objectName, support: "supportAccess" in access && access.supportAccess === true }
    await uploadLegacyDocumentStage(stage, buf, file.type)

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
      const quotaExceeded = mutation.error.includes("Organization document storage quota exceeded")
      return NextResponse.json(
        { error: quotaExceeded ? "This upload exceeds the organization’s 5 GB document storage limit." : mutation.error },
        { status: quotaExceeded ? 413 : mutation.status }
      )
    }

    await reconcileLegacyDocumentCleanup({ orgId, documentKind: key, actorId: user.id, attemptedPaths, support: "supportAccess" in access && access.supportAccess === true })

    await notifyTrackedDocumentUpload({
      supabase,
      userId: user.id,
      documentKind: key,
      filename: file.name,
    })

    return NextResponse.json({ ok: true }, { status: 200, headers: PRIVATE_FILE_HEADERS })
  } catch (err: unknown) {
    const quotaExceeded = err instanceof Error && err.message.includes("Organization document storage quota exceeded")
    return NextResponse.json(
      { error: quotaExceeded ? "This upload exceeds the organization’s 5 GB document storage limit." : err instanceof Error ? err.message : "Upload failed" },
      { status: quotaExceeded ? 413 : 500 }
    )
  } finally {
    if (stage) await reconcileLegacyDocumentUploadStages({ ...stage, attemptedPaths })
  }
}

export async function PATCH(request: NextRequest) {
  const attemptedPaths = new Set<string>()
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
    const storageAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
    if ("error" in storageAccess) {
      return NextResponse.json({ error: storageAccess.error }, { status: 403 })
    }

    await reconcileLegacyDocumentCleanup({ orgId, documentKind: null, actorId: user.id, attemptedPaths, support: "supportAccess" in access && access.supportAccess === true })

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

    return NextResponse.json({ ok: true }, { status: 200, headers: PRIVATE_FILE_HEADERS })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const attemptedPaths = new Set<string>()
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
    const storageAccess = await requireOrganizationDocumentStorage({ supabase, orgId })
    if ("error" in storageAccess) {
      return NextResponse.json({ error: storageAccess.error }, { status: 403 })
    }

    await reconcileLegacyDocumentCleanup({ orgId, documentKind: null, actorId: user.id, attemptedPaths, support: "supportAccess" in access && access.supportAccess === true })

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

    await reconcileLegacyDocumentCleanup({ orgId, documentKind: key, actorId: user.id, attemptedPaths, support: "supportAccess" in access && access.supportAccess === true })

    return NextResponse.json({ ok: true }, { status: 200, headers: PRIVATE_FILE_HEADERS })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    )
  }
}
