import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { privateFileContentUrl, privateStorageResponse } from "@/lib/organization/private-storage-response"
import { privateFileUrlSchema } from "@/lib/organization/private-file-url"

const fetcher = vi.fn<typeof fetch>()
const instant = Date.parse("2026-11-06T06:00:00Z")
const window = { data: { serverNow: new Date(instant).toISOString(), expiresAt: new Date(instant + 60000).toISOString() }, error: null }
const signedUrl = `https://storage.example/object?token=a.${Buffer.from(JSON.stringify({ exp: instant / 1000 + 59 })).toString("base64url")}.b`
const options = () => ({
  request: new Request("http://localhost/api/account/organization-document-files?id=file&content=1"),
  orgId: "organization", name: "Board packet.pdf", mime: "application/pdf", maxBytes: 100, download: false,
  sign: vi.fn().mockResolvedValue({ data: { signedUrl }, error: null }),
  revalidate: vi.fn().mockResolvedValue(true),
})

describe("authenticated private file delivery", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue(window)
    fetcher.mockReset().mockResolvedValue(new Response("PDF", { headers: { "Content-Length": "3", "ETag": "private-provider-tag", "Set-Cookie": "provider-secret=1" } }))
    vi.stubGlobal("fetch", fetcher)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns a stable local address without a Storage capability", () => {
    expect(privateFileContentUrl("/api/account/organization-document-files", { organizationId: "org", id: "file", download: "true" }))
      .toBe("/api/account/organization-document-files?organizationId=org&id=file&download=true&content=1")
  })
  it("accepts only authenticated content paths or legacy HTTPS addresses in existing viewers", () => {
    for (const path of ["organization-document-files", "org-documents", "org-policies/document"])
      expect(privateFileUrlSchema.safeParse(`/api/account/${path}?id=file&content=1`).success).toBe(true)
    expect(privateFileUrlSchema.safeParse("https://storage.example/legacy-file").success).toBe(true)
    for (const value of ["//evil.example/file", "javascript:alert(1)", "/api/account/delete?content=1", "/api/account/org-documents?kind=bylaws", "/api/account/org-documents?content=1#fragment"])
      expect(privateFileUrlSchema.safeParse(value).success).toBe(false)
  })
  it("streams bytes only after fresh source and read-window checks, without provider headers or URLs", async () => {
    const input = options()
    const response = await privateStorageResponse(input)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("PDF")
    expect(input.revalidate).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("cdn-cache-control")).toBe("no-store")
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store")
    expect(response.headers.get("vary")).toBe("Cookie, Authorization")
    expect(response.headers.get("content-disposition")).toContain("inline;")
    for (const header of ["location", "etag", "set-cookie"]) expect(response.headers.has(header)).toBe(false)
    expect([...response.headers].join()).not.toContain("storage.example")
    expect(fetcher).toHaveBeenCalledWith(signedUrl, expect.objectContaining({ cache: "no-store", redirect: "error" }))
  })
  it.each(["image/svg+xml", "text/html", "application/xml", "application/octet-stream"])("forces untrusted active content %s to download", async mime => {
    const response = await privateStorageResponse({ ...options(), mime, name: 'Bad"\r\nX-Injected: true.svg' })
    expect(response.headers.get("content-disposition")).toContain("attachment;")
    expect(response.headers.get("content-disposition")).not.toContain("\n")
    expect(response.headers.has("x-injected")).toBe(false)
    expect(response.headers.get("content-security-policy")).toContain("sandbox;")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    await response.arrayBuffer()
  })
  it("retains Unicode filenames and explicit download behavior", async () => {
    const response = await privateStorageResponse({ ...options(), name: "Büro 资料.pdf", download: true })
    expect(response.headers.get("content-disposition")).toContain("attachment;")
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''B%C3%BCro%20%E8%B5%84%E6%96%99.pdf")
    await response.arrayBuffer()
  })
  it("withholds bytes when access is revoked while Storage is responding", async () => {
    const input = options()
    input.revalidate.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const response = await privateStorageResponse(input)
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("PDF")
  })
  it("rejects a new request to the same app URL after revocation", async () => {
    const input = options()
    expect(await (await privateStorageResponse(input)).text()).toBe("PDF")
    input.revalidate.mockResolvedValue(false)
    expect((await privateStorageResponse(input)).status).toBe(404)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("withholds bytes if the fixed organization read window closes during the fetch", async () => {
    rpc.mockResolvedValueOnce(window).mockResolvedValueOnce(window).mockResolvedValueOnce({ data: null, error: null })
    expect((await privateStorageResponse(options())).status).toBe(404)
  })
  it("preserves single-range media/PDF requests without reusing upstream cache headers", async () => {
    fetcher.mockResolvedValue(new Response("DF", { status: 206, headers: { "Content-Length": "2", "Content-Range": "bytes 1-2/3", "Cache-Control": "public, max-age=3600" } }))
    const response = await privateStorageResponse({ ...options(), request: new Request("http://localhost/file", { headers: { Range: "bytes=1-2" } }) })
    expect(response.status).toBe(206)
    expect(await response.text()).toBe("DF")
    expect(response.headers.get("content-range")).toBe("bytes 1-2/3")
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(fetcher).toHaveBeenCalledWith(signedUrl, expect.objectContaining({ headers: { Range: "bytes=1-2" } }))
  })
  it.each(["bytes=0-1,4-5", "invalid", "bytes=1234567890123456-"])("rejects malformed or multipart Range %s before Storage", async range => {
    const input = { ...options(), request: new Request("http://localhost/file", { headers: { Range: range } }) }
    expect((await privateStorageResponse(input)).status).toBe(416)
    expect(input.sign).not.toHaveBeenCalled()
  })
  it("bounds declared and streamed sizes and rejects truncated transfers", async () => {
    fetcher.mockResolvedValueOnce(new Response("large", { headers: { "Content-Length": "101" } }))
    expect((await privateStorageResponse(options())).status).toBe(404)
    fetcher.mockResolvedValueOnce(new Response("large"))
    await expect((await privateStorageResponse({ ...options(), maxBytes: 2 })).text()).rejects.toThrow("limit")
    fetcher.mockResolvedValueOnce(new Response("short", { headers: { "Content-Length": "9" } }))
    await expect((await privateStorageResponse(options())).text()).rejects.toThrow("incomplete")
  })
  it.each([302, 404, 500])("does not forward upstream status %s or private error content", async status => {
    fetcher.mockResolvedValue(new Response("private upstream failure", { status }))
    const response = await privateStorageResponse(options())
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("private upstream")
  })
})
