import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mock = vi.hoisted(() => ({
  admin: vi.fn(),
  user: vi.fn(),
  organization: vi.fn(),
  upload: vi.fn(),
  signedUrl: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteHandlerClient: () => ({
    auth: { getUser: mock.user },
    storage: {
      from: () => ({ upload: mock.upload, createSignedUrl: mock.signedUrl }),
    },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    mock.admin()
    return { storage: { from: () => ({ createSignedUrl: mock.signedUrl }) } }
  },
}))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mock.organization,
  canEditOrganization: (role: string) =>
    role === "owner" || role === "admin" || role === "staff",
}))
import {
  uploadParticleImage,
  readParticleImage,
} from "@/features/workspace-particles/server/images"

const orgId = "00000000-0000-0000-0000-000000000001"
const imageId = "00000000-0000-0000-0000-000000000002"
function upload(
  bytes: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  mime = "image/png"
) {
  const form = new FormData()
  form.set(
    "file",
    new File([bytes as BlobPart], "Workshop.png", { type: mime })
  )
  return uploadParticleImage(
    new NextRequest("http://localhost/api/workspace/particles/images", {
      method: "POST",
      body: form,
    })
  )
}
function read(path: string) {
  return readParticleImage(
    new NextRequest(
      `http://localhost/api/workspace/particles/images?path=${encodeURIComponent(path)}`
    )
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.user.mockResolvedValue({ data: { user: { id: "viewer" } }, error: null })
  mock.organization.mockResolvedValue({ orgId, role: "owner" })
  mock.upload.mockResolvedValue({ error: null })
  mock.signedUrl.mockResolvedValue({
    data: { signedUrl: "https://example.supabase.co/signed-image" },
    error: null,
  })
})
describe("private particle images", () => {
  it("rejects anonymous reads and uploads before touching storage", async () => {
    mock.user.mockResolvedValue({ data: { user: null }, error: null })
    expect((await upload()).status).toBe(401)
    expect((await read(`${orgId}/particles/${imageId}.png`)).status).toBe(401)
    expect(mock.upload).not.toHaveBeenCalled()
    expect(mock.signedUrl).not.toHaveBeenCalled()
    expect(mock.admin).not.toHaveBeenCalled()
  })
  it.each(["board", "member"])(
    "allows %s to read their org's image but not upload",
    async (role) => {
      mock.organization.mockResolvedValue({ orgId, role })
      expect((await upload()).status).toBe(403)
      const response = await read(`${orgId}/particles/${imageId}.png`)
      expect(response.status).toBe(307)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      expect(mock.signedUrl).toHaveBeenCalledWith(
        `${orgId}/particles/${imageId}.png`,
        60
      )
      expect(mock.upload).not.toHaveBeenCalled()
    }
  )
  it.each([
    `${imageId}/particles/${imageId}.png`,
    `${orgId}/../${imageId}.png`,
    `https://evil.example/${imageId}.png`,
    `${orgId}/particles/${imageId}.svg`,
  ])("denies cross-org and unsupported paths: %s", async (path) => {
    expect((await read(path)).status).toBe(404)
    expect(mock.signedUrl).not.toHaveBeenCalled()
    expect(mock.admin).not.toHaveBeenCalled()
  })
  it("uploads validated bytes to a random path scoped to the active organization", async () => {
    const response = await upload()
    expect(response.status).toBe(201)
    const { image } = await response.json()
    expect(image.path).toMatch(
      new RegExp(`^${orgId}/particles/[a-f0-9-]{36}\\.png$`)
    )
    expect(image.title).toBe("Workshop")
    expect(image).not.toHaveProperty("signedUrl")
    expect(mock.upload).toHaveBeenCalledWith(image.path, expect.any(Buffer), {
      contentType: "image/png",
      upsert: false,
    })
  })
  it("rejects SVG, empty content, MIME spoofing and oversized files", async () => {
    for (const response of [
      await upload(new Uint8Array([1]), "image/svg+xml"),
      await upload(new Uint8Array()),
      await upload(new Uint8Array([1, 2, 3])),
      await upload(new Uint8Array(4 * 1024 * 1024 + 1)),
    ]) {
      expect(response.status).toBe(400)
    }
    expect(mock.upload).not.toHaveBeenCalled()
  })
  it("does not expose provider errors or create phantom image metadata", async () => {
    mock.upload.mockResolvedValue({
      error: { message: "internal bucket details" },
    })
    const response = await upload()
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain("internal bucket")
  })
})
