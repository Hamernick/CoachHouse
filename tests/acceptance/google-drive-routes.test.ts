import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  attachGoogleDriveDocuments: vi.fn(),
  completeGoogleDriveConnection: vi.fn(),
  createGoogleDrivePickerToken: vi.fn(),
  getGoogleDriveConnection: vi.fn(),
  getGoogleDriveDocumentThumbnail: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  requireGoogleDriveContext: vi.fn(),
  startGoogleDriveConnection: vi.fn(),
}))

vi.mock("@/features/google-drive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/google-drive")>()),
  attachGoogleDriveDocuments: mocks.attachGoogleDriveDocuments,
  completeGoogleDriveConnection: mocks.completeGoogleDriveConnection,
  createGoogleDrivePickerToken: mocks.createGoogleDrivePickerToken,
  getGoogleDriveConnection: mocks.getGoogleDriveConnection,
  getGoogleDriveDocumentThumbnail: mocks.getGoogleDriveDocumentThumbnail,
  requireGoogleDriveContext: mocks.requireGoogleDriveContext,
  startGoogleDriveConnection: mocks.startGoogleDriveConnection,
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn },
}))

const user = { id: "user-1" }
const organization = { orgId: "org-1", role: "staff" }

describe("Google Drive route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireGoogleDriveContext.mockResolvedValue({
      supabase: {},
      user,
      organization,
    })
  })

  it("serves private preview bytes scoped to the authenticated workspace", async () => {
    mocks.getGoogleDriveDocumentThumbnail.mockResolvedValue({
      bytes: Buffer.from("thumbnail bytes"),
      contentType: "image/png",
    })
    const { GET } = await import(
      "@/app/api/integrations/google-drive/documents/[documentId]/preview/route"
    )
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/documents/doc-1/preview?organizationId=other-org"
    )
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-1" }),
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("thumbnail bytes")
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toContain("sandbox")
    expect(response.headers.get("x-request-id")).toBeTruthy()
    expect(mocks.requireGoogleDriveContext).toHaveBeenCalledWith(request, expect.anything())
    expect(mocks.getGoogleDriveDocumentThumbnail).toHaveBeenCalledExactlyOnceWith({
      documentId: "doc-1", orgId: "org-1",
    })
  })

  it.each([["unauthorized", 401], ["forbidden", 403]] as const)(
    "rejects %s preview requests before reading a file", async (code, status) => {
      const { GoogleDriveError } = await import("@/features/google-drive")
      mocks.requireGoogleDriveContext.mockRejectedValue(new GoogleDriveError(code, status))
      const { GET } = await import(
        "@/app/api/integrations/google-drive/documents/[documentId]/preview/route"
      )
      const response = await GET(new NextRequest("https://coachhouse.app/preview"), {
        params: Promise.resolve({ documentId: "doc-1" }),
      })
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ ok: false, code })
      expect(mocks.getGoogleDriveDocumentThumbnail).not.toHaveBeenCalled()
    }
  )

  it("redacts failed preview provider details and disables caching", async () => {
    mocks.getGoogleDriveDocumentThumbnail.mockRejectedValue(new Error("token=private-secret"))
    const { GET } = await import(
      "@/app/api/integrations/google-drive/documents/[documentId]/preview/route"
    )
    const response = await GET(new NextRequest("https://coachhouse.app/preview"), {
      params: Promise.resolve({ documentId: "doc-1" }),
    })
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ ok: false, code: "provider_unavailable" })
  })

  it("starts an editor-scoped OAuth flow with redacted no-store output", async () => {
    mocks.startGoogleDriveConnection.mockResolvedValue(
      "https://accounts.google.com/o/oauth2/v2/auth?state=redacted"
    )
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/connect",
      {
        method: "POST",
        body: JSON.stringify({ returnPath: "/organization/documents" }),
        headers: { "content-type": "application/json" },
      }
    )
    const { POST } =
      await import("@/app/api/integrations/google-drive/connect/route")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-request-id")).toBeTruthy()
    expect(mocks.requireGoogleDriveContext).toHaveBeenCalledWith(
      request,
      expect.anything(),
      true
    )
    expect(mocks.startGoogleDriveConnection).toHaveBeenCalledWith({
      userId: "user-1",
      orgId: "org-1",
      returnPath: "/organization/documents",
    })
  })

  it("never exposes provider error details from connect failures", async () => {
    mocks.startGoogleDriveConnection.mockRejectedValue(
      new Error("refresh-token=secret-value")
    )
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/connect",
      { method: "POST" }
    )
    const { POST } =
      await import("@/app/api/integrations/google-drive/connect/route")
    const response = await POST(request)
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(body).toContain("provider_unavailable")
    expect(body).not.toContain("secret-value")
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "google_drive_result",
      expect.not.objectContaining({ error: expect.anything() })
    )
  })

  it("returns Picker tokens only through an editor-scoped no-store response", async () => {
    mocks.createGoogleDrivePickerToken.mockResolvedValue({
      accessToken: "short-lived-access-token",
      developerKey: "picker-developer-key",
      appId: "74627119265",
    })
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/picker-token",
      { method: "POST" }
    )
    const { POST } =
      await import("@/app/api/integrations/google-drive/picker-token/route")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      ok: true,
      accessToken: "short-lived-access-token",
      developerKey: "picker-developer-key",
      appId: "74627119265",
    })
    expect(mocks.requireGoogleDriveContext).toHaveBeenCalledWith(
      request,
      expect.anything(),
      true
    )
  })

  it("preserves a connected account when this environment cannot issue Picker tokens", async () => {
    mocks.getGoogleDriveConnection.mockResolvedValue({
      connected: true,
      googleEmail: "connected@example.org",
      status: "connected",
    })
    const { GoogleDriveError } = await import("@/features/google-drive")
    mocks.createGoogleDrivePickerToken.mockRejectedValue(
      new GoogleDriveError("not_configured", 503)
    )
    const { GET } =
      await import("@/app/api/integrations/google-drive/connection/route")
    const connection = await GET(
      new NextRequest(
        "https://coachhouse.app/api/integrations/google-drive/connection"
      )
    )
    expect(await connection.json()).toMatchObject({
      connection: { connected: true },
    })
    const { POST } =
      await import("@/app/api/integrations/google-drive/picker-token/route")
    const picker = await POST(
      new NextRequest(
        "https://coachhouse.app/api/integrations/google-drive/picker-token",
        { method: "POST" }
      )
    )
    expect(picker.status).toBe(503)
    expect(await picker.json()).toEqual({ ok: false, code: "not_configured" })
    expect(mocks.startGoogleDriveConnection).not.toHaveBeenCalled()
  })

  it("attaches only server-verified file IDs for the active organization", async () => {
    mocks.attachGoogleDriveDocuments.mockResolvedValue(2)
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/documents",
      {
        method: "POST",
        body: JSON.stringify({ fileIds: ["drive-file-one", "drive-file-two"] }),
        headers: { "content-type": "application/json" },
      }
    )
    const { POST } =
      await import("@/app/api/integrations/google-drive/documents/route")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.attachGoogleDriveDocuments).toHaveBeenCalledWith({
      userId: "user-1",
      orgId: "org-1",
      fileIds: ["drive-file-one", "drive-file-two"],
    })
  })

  it.each([
    ["/workspace/documents", "/workspace?drawer=documents&googleDrive=connected"],
    ["/organization/documents", "/organization/documents?googleDrive=connected"],
    ["/workspace?drawer=tools", "/workspace?drawer=tools&googleDrive=connected"],
  ])("returns a successful connection to its originating surface: %s", async (returnPath, expected) => {
    mocks.completeGoogleDriveConnection.mockResolvedValue(returnPath)
    const { GET } = await import("@/app/api/integrations/google-drive/callback/route")
    const request = new NextRequest("https://coachhouse.app/api/integrations/google-drive/callback?state=state&code=code")
    const response = await GET(request)
    expect(response.headers.get("location")).toBe(`https://coachhouse.app${expected}`)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(mocks.requireGoogleDriveContext).toHaveBeenCalledWith(request, expect.anything(), true)
    expect(mocks.completeGoogleDriveConnection).toHaveBeenCalledWith({ userId: user.id, orgId: organization.orgId, state: "state", code: "code" })
  })

  it("reduces denied callbacks to a fixed Documents error redirect", async () => {
    const request = new NextRequest(
      "https://coachhouse.app/api/integrations/google-drive/callback?error=access_denied&error_description=secret-detail"
    )
    const { GET } =
      await import("@/app/api/integrations/google-drive/callback/route")
    const response = await GET(request)
    const location = response.headers.get("location") ?? ""

    expect(response.status).toBe(307)
    expect(location).toBe(
      "https://coachhouse.app/workspace?drawer=tools&googleDrive=authorization_denied"
    )
    expect(location).not.toContain("secret-detail")
    expect(mocks.requireGoogleDriveContext).not.toHaveBeenCalled()
  })
})
