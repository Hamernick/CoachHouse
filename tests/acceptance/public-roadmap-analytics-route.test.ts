import "./test-utils"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSupabaseAdminClientMock, resolvePublicRoadmapSectionsMock, publicAudienceMock } =
  vi.hoisted(() => ({
    createSupabaseAdminClientMock: vi.fn(),
    publicAudienceMock: vi.fn(),
    resolvePublicRoadmapSectionsMock: vi.fn(() => [{ slug: "community-goals" }]),
  }))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}))

vi.mock("@/lib/roadmap/sections", () => ({
  resolvePublicRoadmapSections: resolvePublicRoadmapSectionsMock,
}))

vi.mock("@/lib/organization/public-document-audience", () => ({ filterPublicDocumentSections: publicAudienceMock }))

import { POST } from "@/app/api/public/roadmap-event/route"

type OrganizationResult = {
  data: {
    is_public_roadmap: boolean
    profile: Record<string, unknown>
    user_id: string
  } | null
  error: { message: string } | null
}

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/public/roadmap-event", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  })
}

function adminClient(
  organization: OrganizationResult = {
    data: {
      is_public_roadmap: true,
      profile: {},
      user_id: "org-1",
    },
    error: null,
  },
  rpcResult: { data: unknown; error: { message: string } | null } = {
    data: { status: "recorded" },
    error: null,
  }
) {
  const maybeSingle = vi.fn().mockResolvedValue(organization)
  const eq = vi.fn().mockReturnThis()
  const select = vi.fn().mockReturnValue({ eq, maybeSingle })
  const from = vi.fn().mockReturnValue({ select })
  const rpc = vi.fn().mockResolvedValue(rpcResult)
  const client = { from, rpc }
  createSupabaseAdminClientMock.mockReturnValue(client)
  return { client, eq, rpc }
}

describe("public roadmap analytics route", () => {
  beforeEach(() => {
    createSupabaseAdminClientMock.mockReset()
    resolvePublicRoadmapSectionsMock.mockClear()
    publicAudienceMock.mockReset().mockImplementation(async sections => sections)
  })

  it("rejects forged event types before creating an admin client", async () => {
    const response = await POST(
      request({ eventType: "delete", orgSlug: "coach-house" })
    )

    expect(response.status).toBe(400)
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it("rejects oversized bodies before creating an admin client", async () => {
    const response = await POST(
      request({
        eventType: "view",
        orgSlug: "coach-house",
        source: "x".repeat(4_097),
      })
    )

    expect(response.status).toBe(413)
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it("does not record events for a private organization", async () => {
    const { rpc } = adminClient({
      data: { is_public_roadmap: false, profile: {}, user_id: "org-1" },
      error: null,
    })

    const response = await POST(
      request({ eventType: "view", orgSlug: "coach-house" })
    )

    expect(response.status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects section slugs that are not on the public roadmap", async () => {
    const { rpc } = adminClient()

    const response = await POST(
      request({
        eventType: "view",
        orgSlug: "coach-house",
        sectionId: "forged-section",
      })
    )

    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([null, []])("does not record an event after public audience revocation (%j)", async sections => {
    const { rpc } = adminClient()
    publicAudienceMock.mockResolvedValue(sections)
    const response = await POST(request({ eventType: "view", orgSlug: "coach-house", sectionId: "community-goals" }))
    expect(response.status).toBe(sections === null ? 404 : 400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("does not record events when audience verification fails", async () => {
    const { rpc } = adminClient()
    publicAudienceMock.mockRejectedValue(new Error("unavailable"))
    expect((await POST(request({ eventType: "view", orgSlug: "coach-house" }))).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("records a validated event through the bounded database function", async () => {
    const { eq, rpc } = adminClient()

    const response = await POST(
      request({
        durationMs: 1250.8,
        eventType: "view",
        orgSlug: "Coach-House",
        referrer: "https://example.com/referral",
        sectionId: "community-goals",
        source: "newsletter",
      })
    )

    expect(response.status).toBe(200)
    expect(eq).toHaveBeenCalledWith("public_slug", "coach-house")
    expect(rpc).toHaveBeenCalledWith("record_public_roadmap_event", {
      p_duration_ms: 1250,
      p_event_type: "view",
      p_org_id: "org-1",
      p_referrer: "https://example.com/referral",
      p_section_id: "community-goals",
      p_source: "newsletter",
    })
  })

  it("returns a retry boundary when the organization cap is reached", async () => {
    adminClient(undefined, {
      data: { retryAfterSeconds: 60, status: "rate_limited" },
      error: null,
    })

    const response = await POST(
      request({ eventType: "view", orgSlug: "coach-house" })
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("does not hide database recording failures", async () => {
    adminClient(undefined, {
      data: null,
      error: { message: "database unavailable" },
    })

    const response = await POST(
      request({ eventType: "view", orgSlug: "coach-house" })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Unable to record roadmap event",
    })
  })

  it("enforces atomic minute and daily caps in a service-only function", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260814073000_bound_public_roadmap_analytics.sql"
      ),
      "utf8"
    )

    expect(sql).toContain("security definer")
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain("pg_advisory_xact_lock")
    expect(sql).toContain("interval '1 minute'")
    expect(sql).toContain("interval '1 day'")
    expect(sql).toContain("from public, anon, authenticated")
    expect(sql).toContain("to service_role")
  })
})
