import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { NextResponse, type NextRequest } from "next/server"

import { canEditOrganization } from "@/lib/organization/active-org"
import { mutateOrganizationProfile } from "@/lib/organization/profile-mutation"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

type OrgPolicyStatus = "not_started" | "in_progress" | "complete"
const BUCKET = "org-documents"

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

const ALLOWED_STATUSES = new Set<OrgPolicyStatus>([
  "not_started",
  "in_progress",
  "complete",
])

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
  const status = ALLOWED_STATUSES.has(statusRaw as OrgPolicyStatus)
    ? (statusRaw as OrgPolicyStatus)
    : "not_started"
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
    status,
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

function readPolicies(profile: Record<string, unknown>): OrgPolicy[] {
  const raw = Array.isArray(profile["policies"])
    ? (profile["policies"] as unknown[])
    : []
  return raw
    .map((entry) => normalizePolicy(entry))
    .filter((entry): entry is OrgPolicy => Boolean(entry))
}

function isPolicyDocumentPath(path: string, orgId: string, policyId: string) {
  return path.startsWith(`${orgId}/policies/${policyId}/`)
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
  return { supabase, orgId }
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
    const { orgId } = access
    const profile = await loadProfile(supabase, orgId)
    return NextResponse.json(
      { policies: readPolicies(profile) },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load policies" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOrgEditor(request)
  if ("error" in auth) return auth.error

  const payload = await request.json().catch(() => null)
  const title = typeof payload?.title === "string" ? payload.title.trim() : ""
  if (!title) {
    return NextResponse.json(
      { error: "Policy title is required." },
      { status: 400 }
    )
  }

  const statusRaw =
    typeof payload?.status === "string" ? payload.status : "not_started"
  const status = ALLOWED_STATUSES.has(statusRaw as OrgPolicyStatus)
    ? (statusRaw as OrgPolicyStatus)
    : "not_started"
  const categories = normalizeCategories(payload?.categories)
  if (categories.length === 0 && Boolean(payload?.board)) {
    categories.push("Board")
  }
  const now = new Date().toISOString()
  const nextPolicy: OrgPolicy = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    title,
    summary: typeof payload?.summary === "string" ? payload.summary.trim() : "",
    status,
    categories,
    programId:
      typeof payload?.programId === "string" &&
      payload.programId.trim().length > 0
        ? payload.programId.trim()
        : null,
    personIds: Array.isArray(payload?.personIds)
      ? Array.from(
          new Set(
            (payload.personIds as unknown[])
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0
              )
              .map((value) => value.trim())
          )
        )
      : [],
    document: null,
    updatedAt: now,
  }

  try {
    const mutation = await mutateOrganizationProfile({
      supabase: auth.supabase,
      orgId: auth.orgId,
      mutate: (profile) => {
        const nextPolicies = [nextPolicy, ...readPolicies(profile)]
        return {
          changed: true,
          nextProfile: { ...profile, policies: nextPolicies },
          value: nextPolicies,
        }
      },
    })
    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }
    return NextResponse.json(
      { policy: nextPolicy, policies: mutation.value },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to create policy" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOrgEditor(request)
  if ("error" in auth) return auth.error

  const payload = await request.json().catch(() => null)
  const id = typeof payload?.id === "string" ? payload.id.trim() : ""
  if (!id)
    return NextResponse.json(
      { error: "Policy id is required." },
      { status: 400 }
    )

  const title = typeof payload?.title === "string" ? payload.title.trim() : ""
  if (!title)
    return NextResponse.json(
      { error: "Policy title is required." },
      { status: 400 }
    )

  const statusRaw =
    typeof payload?.status === "string" ? payload.status : "not_started"
  const status = ALLOWED_STATUSES.has(statusRaw as OrgPolicyStatus)
    ? (statusRaw as OrgPolicyStatus)
    : "not_started"
  const categories = normalizeCategories(payload?.categories)
  if (categories.length === 0 && Boolean(payload?.board)) {
    categories.push("Board")
  }

  try {
    const mutation = await mutateOrganizationProfile({
      supabase: auth.supabase,
      orgId: auth.orgId,
      mutate: (profile) => {
        const policies = readPolicies(profile)
        const existing = policies.find((entry) => entry.id === id)
        if (!existing) return { error: "Policy not found.", status: 404 }

        const nextPolicy: OrgPolicy = {
          ...existing,
          title,
          summary:
            typeof payload?.summary === "string" ? payload.summary.trim() : "",
          status,
          categories,
          programId:
            typeof payload?.programId === "string" &&
            payload.programId.trim().length > 0
              ? payload.programId.trim()
              : null,
          personIds: Array.isArray(payload?.personIds)
            ? Array.from(
                new Set(
                  (payload.personIds as unknown[])
                    .filter(
                      (value): value is string =>
                        typeof value === "string" && value.trim().length > 0
                    )
                    .map((value) => value.trim())
                )
              )
            : [],
          updatedAt: new Date().toISOString(),
        }
        const nextPolicies = policies.map((entry) =>
          entry.id === id ? nextPolicy : entry
        )
        return {
          changed: true,
          nextProfile: { ...profile, policies: nextPolicies },
          value: { nextPolicy, nextPolicies },
        }
      },
    })
    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }
    return NextResponse.json(
      {
        policy: mutation.value.nextPolicy,
        policies: mutation.value.nextPolicies,
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to update policy" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOrgEditor(request)
  if ("error" in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim() ?? ""
  if (!id)
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
        const policyToDelete = policies.find((entry) => entry.id === id)
        const nextPolicies = policies.filter((entry) => entry.id !== id)
        return {
          changed: Boolean(policyToDelete),
          nextProfile: { ...profile, policies: nextPolicies },
          value: { path: policyToDelete?.document?.path ?? null, nextPolicies },
        }
      },
    })
    if ("error" in mutation) {
      return NextResponse.json(
        { error: mutation.error },
        { status: mutation.status }
      )
    }

    const { path, nextPolicies } = mutation.value
    if (path && isPolicyDocumentPath(path, auth.orgId, id)) {
      const { error: cleanupError } = await auth.supabase.storage
        .from(BUCKET)
        .remove([path])
      if (cleanupError) console.warn("Failed to remove deleted policy document")
    }
    return NextResponse.json(
      { ok: true, policies: nextPolicies },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to delete policy" },
      { status: 500 }
    )
  }
}
