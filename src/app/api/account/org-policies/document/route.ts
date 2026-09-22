import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { NextResponse, type NextRequest } from "next/server"

import { canEditOrganization } from "@/lib/organization/active-org"
import { mutateOrganizationProfile } from "@/lib/organization/profile-mutation"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

const BUCKET = "org-documents"
const MAX_BYTES = 15 * 1024 * 1024

type OrgPolicyStatus = "not_started" | "in_progress" | "complete"

type OrgPolicyDocument = {
  name: string
  path: string
  size: number
  mime: string
  updatedAt: string
}

type OrgPolicy = {
  id: string
  title: string
  summary: string
  status: OrgPolicyStatus
  categories: string[]
  programId: string | null
  personIds: string[]
  document: OrgPolicyDocument | null
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeCategories(input: unknown): string[] {
  const values = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const output: string[] = []
  for (const entry of values) {
    if (typeof entry !== "string") continue
    const value = entry.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function normalizeDocument(value: unknown): OrgPolicyDocument | null {
  if (!isRecord(value)) return null
  if (typeof value["path"] !== "string" || value["path"].trim().length === 0)
    return null
  return {
    name: typeof value["name"] === "string" ? value["name"] : "",
    path: value["path"],
    size: typeof value["size"] === "number" ? value["size"] : 0,
    mime: typeof value["mime"] === "string" ? value["mime"] : "application/pdf",
    updatedAt:
      typeof value["updatedAt"] === "string"
        ? value["updatedAt"]
        : new Date().toISOString(),
  }
}

function normalizePolicy(entry: unknown): OrgPolicy | null {
  if (!isRecord(entry)) return null
  const id = typeof entry["id"] === "string" ? entry["id"].trim() : ""
  const title = typeof entry["title"] === "string" ? entry["title"].trim() : ""
  if (!id || !title) return null
  const statusRaw =
    typeof entry["status"] === "string" ? entry["status"] : "not_started"
  const personIdsRaw = Array.isArray(entry["personIds"])
    ? (entry["personIds"] as unknown[])
    : []
  const updatedAtRaw =
    typeof entry["updatedAt"] === "string"
      ? entry["updatedAt"]
      : new Date().toISOString()
  const categories = normalizeCategories(entry["categories"])
  const legacyBoard = Boolean(entry["board"])
  return {
    id,
    title,
    summary:
      typeof entry["summary"] === "string" ? entry["summary"].trim() : "",
    status:
      statusRaw === "in_progress" || statusRaw === "complete"
        ? statusRaw
        : "not_started",
    categories:
      categories.length > 0 ? categories : legacyBoard ? ["Board"] : [],
    programId:
      typeof entry["programId"] === "string" &&
      entry["programId"].trim().length > 0
        ? entry["programId"].trim()
        : null,
    personIds: Array.from(
      new Set(
        personIdsRaw
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0
          )
          .map((value) => value.trim())
      )
    ),
    document: normalizeDocument(entry["document"]),
    updatedAt: updatedAtRaw,
  }
}

function readPolicies(profile: Record<string, unknown>): OrgPolicy[] {
  const raw = Array.isArray(profile["policies"])
    ? (profile["policies"] as unknown[])
    : []
  return raw
    .map((entry) => normalizePolicy(entry))
    .filter((entry): entry is OrgPolicy => Boolean(entry))
}

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")
  return cleaned.length > 0 ? cleaned : "document.pdf"
}

function isPolicyDocumentPath(path: string, orgId: string, policyId: string) {
  return path.startsWith(`${orgId}/policies/${policyId}/`)
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
  if (error) throw new Error(error.message)
  return (orgRow?.profile ?? {}) as Record<string, unknown>
}

async function requireOrgEditor(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: error?.message ?? "Unauthorized" },
        { status: 401 }
      ),
    }
  }
  const access = await resolveOrganizationDocumentAccess(
    supabase,
    user.id,
    request.nextUrl.searchParams.get("organizationId")
  )
  if ("error" in access)
    return {
      error: NextResponse.json({ error: access.error }, { status: 403 }),
    }
  supabase = access.supabase
  const { orgId, role } = access
  if (!canEditOrganization(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase, orgId, userId: user.id }
}

async function requireOrgMember(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: error?.message ?? "Unauthorized" },
        { status: 401 }
      ),
    }
  }
  const access = await resolveOrganizationDocumentAccess(
    supabase,
    user.id,
    request.nextUrl.searchParams.get("organizationId")
  )
  if ("error" in access)
    return {
      error: NextResponse.json({ error: access.error }, { status: 403 }),
    }
  supabase = access.supabase
  const { orgId } = access
  return { supabase, orgId }
}

function validatePdf(file: File) {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  if (!isPdf) return "Only PDF files are supported."
  if (file.size > MAX_BYTES) return "PDF must be 15 MB or less."
  return null
}

function getPolicyId(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  return searchParams.get("id")?.trim() ?? ""
}

export async function GET(request: NextRequest) {
  const auth = await requireOrgMember(request)
  if ("error" in auth) return auth.error
  const policyId = getPolicyId(request)
  const { searchParams } = new URL(request.url)
  const downloadRequested = searchParams.get("download") === "1"
  if (!policyId)
    return NextResponse.json(
      { error: "Policy id is required." },
      { status: 400 }
    )

  try {
    const profile = await loadProfile(auth.supabase, auth.orgId)
    const policy = readPolicies(profile).find((entry) => entry.id === policyId)
    if (!policy?.document?.path) {
      return NextResponse.json(
        { error: "Policy document not found." },
        { status: 404 }
      )
    }
    if (!isPolicyDocumentPath(policy.document.path, auth.orgId, policy.id)) {
      return NextResponse.json(
        { error: "Policy document not found." },
        { status: 404 }
      )
    }

    const { data: signed, error: signedError } = await auth.supabase.storage
      .from(BUCKET)
      .createSignedUrl(
        policy.document.path,
        60 * 15,
        downloadRequested
          ? {
              download:
                policy.document.name && policy.document.name.length > 0
                  ? policy.document.name
                  : true,
            }
          : undefined
      )
    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message ?? "Unable to access policy document." },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { url: signed.signedUrl, document: policy.document },
      { status: 200 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load policy document.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOrgEditor(request)
  if ("error" in auth) return auth.error
  const policyId = getPolicyId(request)
  if (!policyId)
    return NextResponse.json(
      { error: "Policy id is required." },
      { status: 400 }
    )

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 })
  }
  const validationError = validatePdf(file)
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 })

  try {
    const objectName = `${auth.orgId}/policies/${policyId}/${Date.now()}-${sanitizeFilename(file.name)}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await auth.supabase.storage
      .from(BUCKET)
      .upload(objectName, buf, {
        contentType: file.type,
      })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const now = new Date().toISOString()
    const nextDocument: OrgPolicyDocument = {
      name: file.name,
      path: objectName,
      size: file.size,
      mime: file.type || "application/pdf",
      updatedAt: now,
    }
    const mutation = await mutateOrganizationProfile({
      supabase: auth.supabase,
      orgId: auth.orgId,
      mutate: (profile) => {
        const policies = readPolicies(profile)
        const existing = policies.find((entry) => entry.id === policyId)
        if (!existing) return { error: "Policy not found.", status: 404 }

        const nextPolicy: OrgPolicy = {
          ...existing,
          document: nextDocument,
          updatedAt: now,
        }
        const nextPolicies = policies.map((entry) =>
          entry.id === policyId ? nextPolicy : entry
        )
        return {
          changed: true,
          nextProfile: { ...profile, policies: nextPolicies },
          value: { nextPolicy, previousPath: existing.document?.path ?? null },
        }
      },
    })
    if ("error" in mutation) {
      await auth.supabase.storage.from(BUCKET).remove([objectName])
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    const { nextPolicy, previousPath } = mutation.value
    if (
      previousPath &&
      previousPath !== objectName &&
      isPolicyDocumentPath(previousPath, auth.orgId, policyId)
    ) {
      const { error: cleanupError } = await auth.supabase.storage
        .from(BUCKET)
        .remove([previousPath])
      if (cleanupError)
        console.warn("Failed to remove replaced policy document")
    }
    return NextResponse.json({ policy: nextPolicy }, { status: 200 })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload policy document.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOrgEditor(request)
  if ("error" in auth) return auth.error
  const policyId = getPolicyId(request)
  if (!policyId)
    return NextResponse.json(
      { error: "Policy id is required." },
      { status: 400 }
    )

  try {
    const mutation = await mutateOrganizationProfile({
      supabase: auth.supabase,
      orgId: auth.orgId,
      mutate: (profile) => {
        const policies = readPolicies(profile)
        const existing = policies.find((entry) => entry.id === policyId)
        if (!existing) return { error: "Policy not found.", status: 404 }
        if (
          !existing.document?.path ||
          !isPolicyDocumentPath(existing.document.path, auth.orgId, policyId)
        ) {
          return { error: "Policy document not found.", status: 404 }
        }

        const nextPolicy: OrgPolicy = {
          ...existing,
          document: null,
          updatedAt: new Date().toISOString(),
        }
        const nextPolicies = policies.map((entry) =>
          entry.id === policyId ? nextPolicy : entry
        )
        return {
          changed: true,
          nextProfile: { ...profile, policies: nextPolicies },
          value: { nextPolicy, path: existing.document.path },
        }
      },
    })
    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    const { nextPolicy, path } = mutation.value
    const { error: cleanupError } = await auth.supabase.storage
      .from(BUCKET)
      .remove([path])
    if (cleanupError) console.warn("Failed to remove deleted policy document")
    return NextResponse.json({ policy: nextPolicy }, { status: 200 })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove policy document.",
      },
      { status: 500 }
    )
  }
}
