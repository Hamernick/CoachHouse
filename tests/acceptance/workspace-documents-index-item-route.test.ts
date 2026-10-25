import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const {
  createSupabaseRouteHandlerClientMock,
  resolveActiveOrganizationMock,
  resolveRoadmapSectionsMock,
  listUserModuleNotesIndexMock,
  resolveOrganizationDocumentAccessMock,
} = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
  resolveActiveOrganizationMock: vi.fn(),
  resolveRoadmapSectionsMock: vi.fn(),
  listUserModuleNotesIndexMock: vi.fn(),
  resolveOrganizationDocumentAccessMock: vi.fn(),
}))

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}))

vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: resolveActiveOrganizationMock,
}))
vi.mock("@/lib/organization/document-access", () => ({
  resolveOrganizationDocumentAccess: resolveOrganizationDocumentAccessMock,
}))

vi.mock("@/lib/roadmap", () => ({
  resolveRoadmapSections: resolveRoadmapSectionsMock,
}))

vi.mock("@/lib/modules/notes-index", () => ({
  listUserModuleNotesIndex: listUserModuleNotesIndexMock,
}))

type SupabaseRouteStubOptions = {
  userId?: string | null
  profile?: Record<string, unknown> | null
}

function buildRouteSupabaseStub({
  userId = "user-1",
  profile = {},
}: SupabaseRouteStubOptions = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { profile },
    error: null,
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn((table: string) => {
    if (table !== "organizations") {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { select }
  })

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from,
  }

  return { supabase, calls: { from, select, eq, maybeSingle } }
}

function buildRequest(id: string) {
  return new NextRequest(
    `http://localhost/api/account/workspace-documents-index/item?id=${encodeURIComponent(id)}`
  )
}

describe("workspace documents item route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveActiveOrganizationMock.mockResolvedValue({ orgId: "org-1" })
    resolveRoadmapSectionsMock.mockReturnValue([])
    listUserModuleNotesIndexMock.mockResolvedValue([])
  })

  it("checks explicit organization access before loading a generated Particle document", async () => {
    const session = buildRouteSupabaseStub()
    const scoped = buildRouteSupabaseStub({ profile: { scoped: true } })
    createSupabaseRouteHandlerClientMock.mockReturnValue(session.supabase)
    resolveOrganizationDocumentAccessMock.mockResolvedValue({
      orgId: "other-org",
      supabase: scoped.supabase,
    })
    resolveRoadmapSectionsMock.mockReturnValue([
      { id: "vision", title: "Vision", content: "<p>Scoped content</p>" },
    ])
    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(
      new NextRequest(
        "http://localhost/api/account/workspace-documents-index/item?id=roadmap%3Avision&organizationId=other-org"
      )
    )
    expect(response.status).toBe(200)
    expect(resolveOrganizationDocumentAccessMock).toHaveBeenCalledWith(
      session.supabase,
      "user-1",
      "other-org"
    )
    expect(scoped.calls.eq).toHaveBeenCalledWith("user_id", "other-org")
    expect(session.calls.from).not.toHaveBeenCalled()
    expect(resolveActiveOrganizationMock).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      detail: { contentHtml: "<p>Scoped content</p>" },
    })
  })

  it("rejects a denied organization without reading its generated content", async () => {
    const { supabase, calls } = buildRouteSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    resolveOrganizationDocumentAccessMock.mockResolvedValue({
      error: "Forbidden",
    })
    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(
      new NextRequest(
        "http://localhost/api/account/workspace-documents-index/item?id=roadmap%3Avision&organizationId=other-org"
      )
    )
    expect(response.status).toBe(403)
    expect(calls.from).not.toHaveBeenCalled()
  })

  it("loads policy file references through the checked organization scope", async () => {
    const session = buildRouteSupabaseStub()
    const scoped = buildRouteSupabaseStub({
      profile: {
        policies: [
          {
            id: "policy-1",
            title: "Policy",
            document: {
              name: "Policy.pdf",
              path: "other-org/policies/policy-1/report.pdf",
              size: 1234,
              mime: "application/pdf",
              updatedAt: "2026-10-14",
            },
          },
        ],
      },
    })
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({
        data: { signedUrl: "https://example.test/private-policy.pdf" },
        error: null,
      })
    const scopedClient = {
      ...scoped.supabase,
      storage: { from: () => ({ createSignedUrl }) },
    }
    createSupabaseRouteHandlerClientMock.mockReturnValue(session.supabase)
    resolveOrganizationDocumentAccessMock.mockResolvedValue({
      orgId: "other-org",
      supabase: scopedClient,
    })
    const { GET } =
      await import("@/app/api/account/org-policies/document/route")
    const response = await GET(
      new NextRequest(
        "http://localhost/api/account/org-policies/document?id=policy-1&organizationId=other-org"
      )
    )
    expect(response.status).toBe(200)
    expect(scoped.calls.eq).toHaveBeenCalledWith("user_id", "other-org")
    expect(createSignedUrl).toHaveBeenCalledWith(
      "other-org/policies/policy-1/report.pdf",
      expect.any(Number),
      undefined
    )
    expect(session.calls.from).not.toHaveBeenCalled()
  })

  it("rejects policy references outside the checked organization scope", async () => {
    const { supabase, calls } = buildRouteSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    resolveOrganizationDocumentAccessMock.mockResolvedValue({
      error: "Forbidden",
    })
    const { GET } =
      await import("@/app/api/account/org-policies/document/route")
    const response = await GET(
      new NextRequest(
        "http://localhost/api/account/org-policies/document?id=policy-1&organizationId=other-org"
      )
    )
    expect(response.status).toBe(403)
    expect(calls.from).not.toHaveBeenCalled()
  })

  it("returns 401 when request is unauthenticated", async () => {
    const { supabase } = buildRouteSupabaseStub({ userId: null })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(buildRequest("roadmap:origin_story"))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: "Unauthorized" })
  })

  it("returns sanitized roadmap html detail", async () => {
    const { supabase, calls } = buildRouteSupabaseStub({
      profile: { anything: true },
    })
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    resolveRoadmapSectionsMock.mockReturnValue([
      {
        id: "origin_story",
        slug: "origin-story",
        title: "Origin Story",
        subtitle: "How it started",
        content:
          "<p><strong>Mission</strong> first.</p><a href=\"javascript&colon;alert('xss')\">unsafe link</a><script>alert('xss')</script>",
        lastUpdated: "2026-03-03T12:00:00.000Z",
      },
    ])

    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(buildRequest("roadmap:origin-story"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(resolveActiveOrganizationMock).toHaveBeenCalledTimes(1)
    expect(calls.from).toHaveBeenCalledWith("organizations")
    expect(payload.detail).toMatchObject({
      id: "roadmap:origin-story",
      source: "roadmap",
      previewType: "roadmap_html",
      title: "Origin Story",
      subtitle: "How it started",
      updatedAt: "2026-03-03T12:00:00.000Z",
    })
    expect(payload.detail.contentHtml).toContain("<strong>Mission</strong>")
    expect(payload.detail.contentHtml).not.toContain("<script>")
    expect(payload.detail.contentHtml).not.toContain("javascript")
  })

  it("returns note markdown detail", async () => {
    const { supabase } = buildRouteSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)
    listUserModuleNotesIndexMock.mockResolvedValue([
      {
        moduleId: "mod-42",
        moduleTitle: "Budget Basics",
        classTitle: "Accelerator Core",
        updatedAt: "2026-03-02T18:00:00.000Z",
        content: "## Key Notes\n- Keep runway visible",
        href: "/accelerator/class/foundation/module/3?from=documents",
      },
    ])

    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(buildRequest("note:mod-42"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listUserModuleNotesIndexMock).toHaveBeenCalledTimes(1)
    expect(payload.detail).toMatchObject({
      id: "note:mod-42",
      source: "note",
      previewType: "markdown",
      title: "Budget Basics notes",
      subtitle: "Accelerator Core · Accelerator",
      contentMarkdown: "## Key Notes\n- Keep runway visible",
    })
  })

  it("returns 400 for unsupported id type", async () => {
    const { supabase } = buildRouteSupabaseStub()
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase)

    const { GET } =
      await import("@/app/api/account/workspace-documents-index/item/route")
    const response = await GET(buildRequest("upload:verification-letter"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "Unsupported item type.",
    })
  })
})
