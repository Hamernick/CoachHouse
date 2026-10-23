import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"

const { fetchProfile } = vi.hoisted(() => ({ fetchProfile: vi.fn() }))
vi.mock("@/lib/queries/public-profile", () => ({ fetchPublicProfileByHandle: fetchProfile }))

import { loadPublicShareLogo, servePublicProfileShareImage } from "@/app/[org]/share-image.png/_lib/public-profile-share-image"
import { GET } from "@/app/[org]/share-image.png/route"

const storage = "https://vswzhuwjtgzrkxknrmxu.supabase.co"
const logoUrl = `${storage}/storage/v1/object/public/org-media/public-org/logo/fixture.png`
const logo = readFileSync("public/coach-house-logo-dark.png")

function organization() {
  return { kind: "organization", handle: "example", displayName: "Example Organization", avatarUrl: logoUrl }
}
function assertPng(bytes: ArrayBuffer) {
  const buffer = Buffer.from(bytes)
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  expect(buffer.readUInt32BE(16)).toBe(1200)
  expect(buffer.readUInt32BE(20)).toBe(630)
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

describe("public brand image delivery", () => {
  it("renders a public uploaded logo as a large PNG without redirecting to storage", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    fetchProfile.mockResolvedValue(organization())
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array(logo), { headers: { "Content-Type": "image/png" } }))
    vi.stubGlobal("fetch", fetch)
    const response = await GET(new Request("https://coach.test/example/share-image.png"), { params: Promise.resolve({ org: "example" }) })
    expect(fetchProfile).toHaveBeenCalledWith("example")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toContain("s-maxage=300")
    expect(fetch).toHaveBeenCalledWith(new URL(logoUrl), expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }))
    assertPng(await response.arrayBuffer())
  })

  it.each([null, { kind: "person", displayName: "Private fixture" }])("never renders unpublished, missing or non-organization data: %s", async (profile) => {
    fetchProfile.mockResolvedValue(profile)
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    const response = await servePublicProfileShareImage("missing")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["unavailable", "invalid", "missing"])("keeps a branded initials image when the logo is %s", async (failure) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    fetchProfile.mockResolvedValue({ ...organization(), avatarUrl: failure === "missing" ? null : logoUrl })
    vi.stubGlobal("fetch", failure === "unavailable" ? vi.fn().mockRejectedValue(new Error("timeout")) : vi.fn().mockResolvedValue(new Response("not an image", { headers: { "Content-Type": "image/png" } })))
    const response = await servePublicProfileShareImage("example")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toContain("s-maxage=30")
    assertPng(await response.arrayBuffer())
  })
})

describe("bounded public logo loading", () => {
  it.each([
    null, "invalid", "http://127.0.0.1/private", "https://example.org/logo.png",
    `${storage}.evil.test/storage/v1/object/public/org-media/logo.png`,
    `${storage}/storage/v1/object/sign/org-media/private.png?token=fixture`,
    `${storage}/storage/v1/object/public/private-documents/file.png`,
    `https://user:password@vswzhuwjtgzrkxknrmxu.supabase.co/storage/v1/object/public/org-media/logo.png`,
  ])("does not fetch unapproved locations: %s", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    expect(await loadPublicShareLogo(url)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each<{ body: string | Uint8Array<ArrayBuffer>; headers: Record<string, string> }>([
    { body: "wrong format", headers: { "Content-Type": "text/html" } },
    { body: "oversized", headers: { "Content-Type": "image/png", "Content-Length": "9999999" } },
    { body: new Uint8Array(3 * 1024 * 1024 + 1), headers: { "Content-Type": "image/png" } },
    { body: "", headers: { "Content-Type": "image/png" } },
    { body: '<svg><image href="http://127.0.0.1/private"/></svg>', headers: { "Content-Type": "image/svg+xml" } },
  ])("rejects unsafe, oversized or empty image responses", async ({ body, headers }) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers })))
    expect(await loadPublicShareLogo(logoUrl)).toBeNull()
  })

  it.each(["png", "jpeg", "webp", "svg"] as const)("normalizes uploaded %s logos to a bounded PNG", async (format) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    const body = format === "svg"
      ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="blue"/></svg>')
      : await sharp(logo).toFormat(format).toBuffer()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(body), { headers: { "Content-Type": format === "svg" ? "image/svg+xml" : `image/${format}` } })))
    const data = await loadPublicShareLogo(logoUrl)
    expect(data).toMatch(/^data:image\/png;base64,/)
    const metadata = await sharp(Buffer.from(data!.split(",")[1], "base64")).metadata()
    expect(metadata.format).toBe("png")
    expect(metadata.width).toBeLessThanOrEqual(512)
    expect(metadata.height).toBeLessThanOrEqual(512)
  })

  it("removes empty padding without cropping a wide logo", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    const mark = await sharp({ create: { width: 600, height: 200, channels: 4, background: "#0000ff" } }).png().toBuffer()
    const padded = await sharp({ create: { width: 800, height: 600, channels: 4, background: "#ffffff" } }).composite([{ input: mark, left: 100, top: 200 }]).png().toBuffer()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(padded), { headers: { "Content-Type": "image/png" } })))
    const data = await loadPublicShareLogo(logoUrl)
    const metadata = await sharp(Buffer.from(data!.split(",")[1], "base64")).metadata()
    expect(metadata.width).toBe(512)
    expect(metadata.height).toBe(171)
  })

  it("removes white icon padding after flattening transparent rounded corners", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", storage)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(logo), { headers: { "Content-Type": "image/png" } })))
    const data = await loadPublicShareLogo(logoUrl)
    const metadata = await sharp(Buffer.from(data!.split(",")[1], "base64")).metadata()
    expect(metadata.width).toBeLessThan(300)
    expect(metadata.height).toBeLessThan(300)
  })

  it("uses the same 1200x630 PNG format for the static homepage preview", () => {
    const image = readFileSync("public/brand-share.png")
    assertPng(image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer)
  })
})
