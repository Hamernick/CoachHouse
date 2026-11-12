import { NextResponse } from "next/server"

import { resolvePublicRoadmapSections } from "@/lib/roadmap/sections"
import { filterPublicDocumentSections } from "@/lib/organization/public-document-audience"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const MAX_BODY_BYTES = 4_096
const MAX_DURATION_MS = 86_400_000
const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SECTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type EventBody = {
  orgSlug: string
  sectionId: string | null
  eventType: "view" | "cta_click"
  durationMs: number | null
  source: string | null
  referrer: string | null
}

type OrganizationRow = {
  is_public_roadmap: boolean | null
  profile: unknown
  user_id: string
}

function boundedOptionalString(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  if (normalized.length > maxLength) return undefined
  return normalized || null
}

function parseEventBody(value: unknown): EventBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>

  if (typeof body.orgSlug !== "string") return null
  const orgSlug = body.orgSlug.trim().toLowerCase()
  if (orgSlug.length > 60 || !ORG_SLUG_PATTERN.test(orgSlug)) return null

  if (body.eventType !== "view" && body.eventType !== "cta_click") return null

  const sectionId = boundedOptionalString(body.sectionId, 80)
  if (sectionId === undefined) return null
  if (sectionId !== null && !SECTION_SLUG_PATTERN.test(sectionId)) return null

  const source = boundedOptionalString(body.source, 200)
  const referrer = boundedOptionalString(body.referrer, 1_000)
  if (source === undefined || referrer === undefined) return null

  let durationMs: number | null = null
  if (body.durationMs !== null && body.durationMs !== undefined) {
    if (
      typeof body.durationMs !== "number" ||
      !Number.isFinite(body.durationMs) ||
      body.durationMs < 0 ||
      body.durationMs > MAX_DURATION_MS
    ) {
      return null
    }
    durationMs = Math.floor(body.durationMs)
  }

  return {
    durationMs,
    eventType: body.eventType,
    orgSlug,
    referrer,
    sectionId,
    source,
  }
}

function publicProfile(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    )
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    )
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = parseEventBody(decoded)
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid roadmap event" },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const { data: orgRow, error } = await admin
    .from("organizations")
    .select("user_id, profile, is_public_roadmap")
    .eq("public_slug", payload.orgSlug)
    .maybeSingle<OrganizationRow>()

  if (error) {
    return NextResponse.json(
      { error: "Unable to resolve organization" },
      { status: 500 }
    )
  }

  if (!orgRow?.is_public_roadmap) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    )
  }

  let sections
  try {
    sections = await filterPublicDocumentSections(resolvePublicRoadmapSections(publicProfile(orgRow.profile)), orgRow.user_id)
  } catch {
    return NextResponse.json({ error: "Unable to verify roadmap access" }, { status: 503 })
  }
  if (sections === null) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  if (payload.sectionId) {
    const validSection = sections.some((section) => section.slug === payload.sectionId)
    if (!validSection) {
      return NextResponse.json(
        { error: "Invalid roadmap section" },
        { status: 400 }
      )
    }
  }

  const { data, error: recordError } = await admin.rpc(
    "record_public_roadmap_event",
    {
      p_duration_ms: payload.durationMs,
      p_event_type: payload.eventType,
      p_org_id: orgRow.user_id,
      p_referrer: payload.referrer,
      p_section_id: payload.sectionId,
      p_source: payload.source,
    }
  )

  if (recordError) {
    return NextResponse.json(
      { error: "Unable to record roadmap event" },
      { status: 500 }
    )
  }

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  if (result?.status === "rate_limited") {
    const retryAfterSeconds =
      typeof result.retryAfterSeconds === "number"
        ? Math.max(1, Math.floor(result.retryAfterSeconds))
        : 60
    return NextResponse.json(
      { error: "Roadmap analytics limit reached" },
      {
        headers: { "Retry-After": String(retryAfterSeconds) },
        status: 429,
      }
    )
  }
  if (result?.status === "not_found") {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    )
  }
  if (result?.status !== "recorded") {
    return NextResponse.json(
      { error: "Unable to record roadmap event" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
