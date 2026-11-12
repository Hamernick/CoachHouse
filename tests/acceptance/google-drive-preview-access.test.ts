import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({ admin: vi.fn(), attachment: vi.fn(), owner: vi.fn(), token: vi.fn(), download: vi.fn(), context: vi.fn(), recheck: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/features/google-drive/server/token-crypto", () => ({ decryptGoogleDriveSecret: () => "private-refresh", encryptGoogleDriveSecret: vi.fn() }))
vi.mock("@/features/google-drive/server/google-api", () => ({ refreshGoogleDriveAccessToken: mocks.token }))
vi.mock("@/features/google-drive/server/file-content", () => ({ downloadGoogleDriveThumbnail: mocks.download }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }))
vi.mock("@/features/google-drive", async () => ({
  GoogleDriveError: (await import("@/features/google-drive/types")).GoogleDriveError,
  getGoogleDriveDocumentThumbnail: (await import("@/features/google-drive/server/service")).getGoogleDriveDocumentThumbnail,
  requireGoogleDriveContext: mocks.context,
}))
import { getGoogleDriveDocumentThumbnail } from "@/features/google-drive/server/service"
import { GoogleDriveError } from "@/features/google-drive/types"
import { GET } from "@/app/api/integrations/google-drive/documents/[documentId]/preview/route"
const documentId = "10000000-0000-4000-8000-000000000001"
const input = { documentId, orgId: "current-org", actorId: "current-user" }
const attachment = { provider_file_id: "selected-file", connection_id: "connection-id", status: "available" }
const connection = { id: "connection-id", user_id: "owner", status: "connected", refresh_token_ciphertext: "ciphertext", refresh_token_iv: "iv", refresh_token_auth_tag: "tag", key_version: 1 }
const thumbnail = { bytes: Buffer.from("bounded image"), contentType: "image/png" }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.attachment.mockResolvedValue({ data: attachment, error: null })
  mocks.owner.mockResolvedValue({ data: connection, error: null })
  mocks.token.mockResolvedValue("private-token")
  mocks.download.mockResolvedValue(thumbnail)
  mocks.admin.mockImplementation(() => ({ from: (table: string) => {
    const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: table === "organization_external_documents" ? mocks.attachment : mocks.owner }
    return q
  } }))
  mocks.recheck.mockResolvedValue(undefined)
  mocks.context.mockResolvedValue({ user: { id: input.actorId }, organization: { orgId: input.orgId }, recheck: mocks.recheck })
})
it("rechecks the exact attachment and connection after loading bounded bytes", async () => {
  expect(await getGoogleDriveDocumentThumbnail(input)).toEqual(thumbnail)
  expect(mocks.download).toHaveBeenCalledExactlyOnceWith("private-token", "selected-file")
  expect(mocks.attachment).toHaveBeenCalledTimes(2)
  expect(mocks.owner).toHaveBeenCalledTimes(3)
  expect(mocks.admin).toHaveBeenCalledWith({ actorId: input.actorId, requestTimeoutMs: 10000 })
})
it.each(["detached", "trashed", "replaced", "connection-changed", "disconnected", "owner-changed", "unverifiable"])("discards bytes when %s occurs during loading", async kind => {
  mocks.download.mockImplementationOnce(async () => {
    if (kind === "disconnected" || kind === "owner-changed") mocks.owner.mockResolvedValue({ data: { ...connection, status: kind === "disconnected" ? "disconnected" : "connected", user_id: kind === "owner-changed" ? "another-owner" : "owner" }, error: null })
    else mocks.attachment.mockResolvedValue({ data: kind === "detached" ? null : { ...attachment, status: kind === "trashed" ? "trashed" : "available", provider_file_id: kind === "replaced" ? "another-file" : "selected-file", connection_id: kind === "connection-changed" ? "another-connection" : "connection-id" }, error: kind === "unverifiable" ? Error("Read failed") : null })
    return thumbnail
  })
  await expect(getGoogleDriveDocumentThumbnail(input)).rejects.toBeInstanceOf(GoogleDriveError)
})
it("denies missing attachments before contacting the provider", async () => {
  mocks.attachment.mockResolvedValue({ data: null, error: null })
  await expect(getGoogleDriveDocumentThumbnail(input)).rejects.toMatchObject({ code: "file_not_authorized" })
  expect(mocks.token).not.toHaveBeenCalled()
  expect(mocks.download).not.toHaveBeenCalled()
})
const read = (org = input.orgId) => GET(new NextRequest(`https://example.test/api/integrations/google-drive/documents/${documentId}/preview?organizationId=${org}`), { params: Promise.resolve({ documentId }) })
it("rejects a stale organization before reading attachment metadata", async () => {
  expect((await read("another-org")).status).toBe(403)
  expect(mocks.admin).not.toHaveBeenCalled()
})
it("requires fresh parent access after provider bytes return", async () => {
  mocks.recheck.mockRejectedValue(new GoogleDriveError("forbidden", 403))
  const response = await read()
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain("bounded image")
})
it("returns a private uncached preview without credentials", async () => {
  const response = await read()
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(await response.text()).toBe("bounded image")
  expect(mocks.recheck).toHaveBeenCalledOnce()
})
