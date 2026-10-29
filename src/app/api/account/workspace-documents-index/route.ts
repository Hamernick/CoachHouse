import { organizationLearningUserId } from "@/lib/accelerator/organization-context"
import { NextResponse, type NextRequest } from "next/server"

import { DOCUMENTS } from "@/components/organization/org-profile-card/tabs/documents-tab/constants"
import { listUserModuleNotesIndex } from "@/lib/modules/notes-index"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

type WorkspaceDocumentSource = "upload" | "policy" | "roadmap" | "note"

type WorkspaceDocumentIndexItem = {
  id: string
  source: WorkspaceDocumentSource
  title: string
  subtitle: string | null
  summary: string | null
  updatedAt: string | null
  href: string | null
  documentKind: string | null
  policyId: string | null
  mime: string | null
  sizeBytes: number | null
}

type PolicyStatus = "not_started" | "in_progress" | "complete"

type PolicyDocument = {
  name: string
  path: string
  size: number
  mime: string
  updatedAt: string
}

type PolicyEntry = {
  id: string
  title: string
  summary: string
  status: PolicyStatus
  categories: string[]
  document: PolicyDocument | null
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toTimestamp(value: string | null) {
  if (!value) return 0
  const parsed = new Date(value)
  const timestamp = parsed.getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function normalizeSummary(value: string | null | undefined, maxLength = 220) {
  if (!value) return null
  const compact = value.replace(/\s+/g, " ").trim()
  if (!compact) return null
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1)}…`
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

function normalizePolicyDocument(value: unknown): PolicyDocument | null {
  if (!isRecord(value)) return null
  const path = typeof value.path === "string" ? value.path.trim() : ""
  if (!path) return null

  return {
    name: typeof value.name === "string" ? value.name : "",
    path,
    size: typeof value.size === "number" ? value.size : 0,
    mime: typeof value.mime === "string" ? value.mime : "application/pdf",
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  }
}

function normalizePolicyEntry(value: unknown): PolicyEntry | null {
  if (!isRecord(value)) return null

  const id = typeof value.id === "string" ? value.id.trim() : ""
  const title = typeof value.title === "string" ? value.title.trim() : ""
  if (!id || !title) return null

  const statusRaw =
    typeof value.status === "string" ? value.status : ("not_started" as PolicyStatus)
  const status: PolicyStatus =
    statusRaw === "in_progress" || statusRaw === "complete"
      ? statusRaw
      : "not_started"

  return {
    id,
    title,
    summary: typeof value.summary === "string" ? value.summary.trim() : "",
    status,
    categories: normalizeCategories(value.categories),
    document: normalizePolicyDocument(value.document),
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  }
}

function isUploadPathForOrg(path: string, orgId: string, kind: string) {
  return path.startsWith(`${orgId}/${kind}/`)
}

function isPolicyPathForOrg(path: string, orgId: string, policyId: string) {
  return path.startsWith(`${orgId}/policies/${policyId}/`)
}

function loadUploadItems(
  profile: Record<string, unknown>,
  orgId: string,
): WorkspaceDocumentIndexItem[] {
  const root = isRecord(profile.documents)
    ? (profile.documents as Record<string, unknown>)
    : {}

  const output: WorkspaceDocumentIndexItem[] = []

  for (const definition of DOCUMENTS) {
    const raw = root[definition.key]
    if (!isRecord(raw)) continue

    const path = typeof raw.path === "string" ? raw.path.trim() : ""
    if (!path) continue
    if (!isUploadPathForOrg(path, orgId, definition.kind)) continue

    const name =
      typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name.trim()
        : definition.title

    output.push({
      id: `upload:${definition.kind}`,
      source: "upload",
      title: name,
      subtitle: definition.title,
      summary: normalizeSummary(definition.description),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      href: "/organization/documents",
      documentKind: definition.kind,
      policyId: null,
      mime: typeof raw.mime === "string" ? raw.mime : "application/pdf",
      sizeBytes: typeof raw.size === "number" ? raw.size : null,
    })
  }

  return output
}

function loadPolicyItems(
  profile: Record<string, unknown>,
  orgId: string,
): WorkspaceDocumentIndexItem[] {
  const rawPolicies = Array.isArray(profile.policies) ? profile.policies : []
  const normalizedPolicies = rawPolicies
    .map((entry) => normalizePolicyEntry(entry))
    .filter((entry): entry is PolicyEntry => Boolean(entry))

  return normalizedPolicies.map((policy) => {
    const hasSafePath = policy.document?.path
      ? isPolicyPathForOrg(policy.document.path, orgId, policy.id)
      : false
    const document = hasSafePath ? policy.document : null
    const subtitleParts: string[] = [`Policy · ${policy.status.replace("_", " ")}`]
    if (policy.categories.length > 0) {
      subtitleParts.push(policy.categories.slice(0, 2).join(", "))
    }

    return {
      id: `policy:${policy.id}`,
      source: "policy",
      title: policy.title,
      subtitle: subtitleParts.join(" · "),
      summary: normalizeSummary(policy.summary),
      updatedAt: policy.updatedAt ?? document?.updatedAt ?? null,
      href: "/organization/documents",
      documentKind: null,
      policyId: policy.id,
      mime: document?.mime ?? null,
      sizeBytes: document?.size ?? null,
    } satisfies WorkspaceDocumentIndexItem
  })
}

function loadRoadmapItems(
  profile: Record<string, unknown>,
): WorkspaceDocumentIndexItem[] {
  return resolveRoadmapSections(profile).map((section) => {
    const sectionKey = section.slug?.trim() || section.id
    return {
      id: `roadmap:${sectionKey}`,
      source: "roadmap",
      title: section.title,
      subtitle: section.subtitle,
      summary: normalizeSummary(section.content || section.subtitle),
      updatedAt: section.lastUpdated,
      href: `/roadmap#${sectionKey}`,
      documentKind: null,
      policyId: null,
      mime: null,
      sizeBytes: null,
    } satisfies WorkspaceDocumentIndexItem
  })
}

function sortAndFilterItems(
  items: WorkspaceDocumentIndexItem[],
  query: string,
  limit: number,
) {
  const normalizedQuery = query.trim().toLowerCase()

  const filtered =
    normalizedQuery.length === 0
      ? items
      : items.filter((item) =>
          [item.title, item.subtitle ?? "", item.summary ?? "", item.source]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )

  return filtered
    .slice()
    .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt))
    .slice(0, limit)
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") ?? ""
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 120)
    : 48

  try {
    const activeOrg = await resolveActiveOrganization(supabase, user.id)
    const { orgId } = activeOrg
    const { data: orgRow, error: orgError } = await supabase
      .from("organizations")
      .select("profile")
      .eq("user_id", orgId)
      .maybeSingle<{ profile: Record<string, unknown> | null }>()

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 })
    }

    const profile = (orgRow?.profile ?? {}) as Record<string, unknown>
    const uploadItems = loadUploadItems(profile, orgId)
    const policyItems = loadPolicyItems(profile, orgId)
    const roadmapItems = loadRoadmapItems(profile)

    let noteItems: WorkspaceDocumentIndexItem[] = []
    try {
      const notes = await listUserModuleNotesIndex({
        supabase,
        userId: organizationLearningUserId(user.id, activeOrg),
        limit: 32,
      })
      noteItems = notes.map((note) => ({
        id: `note:${note.moduleId}`,
        source: "note",
        title: `${note.moduleTitle} notes`,
        subtitle: note.classTitle ? `${note.classTitle} · Accelerator` : "Accelerator",
        summary: normalizeSummary(note.content),
        updatedAt: note.updatedAt,
        href: note.href ?? "/organization/documents",
        documentKind: null,
        policyId: null,
        mime: "text/markdown",
        sizeBytes: null,
      }))
    } catch (notesError) {
      console.error("[workspace-documents-index] unable to load notes", notesError)
    }

    const allItems = [
      ...uploadItems,
      ...policyItems,
      ...roadmapItems,
      ...noteItems,
    ]
    const items = sortAndFilterItems(allItems, query, limit)

    return NextResponse.json(
      {
        items,
        total: allItems.length,
      },
      { status: 200 },
    )
  } catch (loadError: unknown) {
    return NextResponse.json(
      {
        error:
          loadError instanceof Error
            ? loadError.message
            : "Unable to load workspace documents index",
      },
      { status: 500 },
    )
  }
}
