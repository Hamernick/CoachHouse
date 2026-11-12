import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
import { reconcileLegacyDocumentUploadStages, uploadLegacyDocumentStage } from "@/lib/organization/legacy-document-upload-stage"

const orgId = "00000000-0000-4000-8000-000000000001"
const path = `${orgId}/w9/stage.pdf`
const stage = { orgId, actorId: orgId, documentKind: "w9", path }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.admin.mockReturnValue({ rpc: mocks.rpc, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } })
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null })
  mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data:
    name === "reserve_legacy_document_upload" ? { path, state: "staged" }
      : name === "abandon_legacy_document_upload" ? "abandoned"
        : name === "reserve_legacy_document_stage_cleanup" ? [{ path, kind: "w9" }] : true }))
})

describe("durable legacy upload stage transport", () => {
  it("reserves exact bytes before upload through the verified actor transport", async () => {
    await uploadLegacyDocumentStage({ ...stage, support: true }, Buffer.from("PDF"), "application/pdf")
    expect(mocks.admin).toHaveBeenCalledExactlyOnceWith({ actorId: orgId, requestTimeoutMs: 10000 })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reserve_legacy_document_upload", {
      p_org: orgId, p_kind: "w9", p_path: path, p_size: 3, p_actor: orgId, p_support: true,
    })
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0])
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(path, Buffer.from("PDF"), { contentType: "application/pdf" })
  })
  it.each(["lost", "denied", "malformed", "foreign", "committed"])("does not send bytes after a %s reservation response", async mode => {
    mocks.rpc.mockImplementation(async () => {
      if (mode === "lost") throw Error("Transport unavailable")
      return mode === "denied" ? { error: { message: "Denied" }, data: null }
        : { error: null, data: mode === "malformed" ? { state: "secret-value" } : { path: mode === "foreign" ? "foreign/file" : path, state: mode === "committed" ? "committed" : "staged" } }
    })
    await expect(uploadLegacyDocumentStage(stage, Buffer.from("PDF"), "application/pdf")).rejects.toThrow()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("keeps malformed reservation details out of the error", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { state: "secret-value" } })
    await expect(uploadLegacyDocumentStage(stage, Buffer.from("PDF"), "application/pdf")).rejects.toThrow("Document upload is no longer available")
  })
  it.each(["committed", "cleaned", "missing"])("never removes a %s reservation path", async state => {
    mocks.rpc.mockResolvedValue({ data: state, error: null })
    await reconcileLegacyDocumentUploadStages(stage)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("abandon_legacy_document_upload", { p_org: orgId, p_path: path, p_actor: orgId, p_support: false })
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("claims and finalizes only the exact abandoned path", async () => {
    await reconcileLegacyDocumentUploadStages(stage)
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([path])
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_legacy_document_stage_cleanup", { p_org: orgId, p_path: path, p_actor: orgId, p_support: false })
    expect(mocks.admin).toHaveBeenCalledWith({ actorId: orgId, requestTimeoutMs: 10000 })
  })
  it.each(["foreign", "other-path", "duplicate", "malformed", "lost"])("does not delete after %s cleanup reservation", async mode => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "abandon_legacy_document_upload") return { data: "abandoned", error: null }
      if (mode === "lost") throw Error("Unavailable")
      const receipt = { path, kind: "w9" }
      return { error: null, data: mode === "foreign" ? [{ ...receipt, path: "foreign/w9/stage.pdf" }]
        : mode === "other-path" ? [{ ...receipt, path: `${orgId}/w9/another.pdf` }]
          : mode === "duplicate" ? [receipt, receipt] : [{ path }] }
    })
    await reconcileLegacyDocumentUploadStages(stage)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it("does not release accounting on uncertain Storage removal or retry the path in the same request", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "Lost reply" } })
    const attemptedPaths = new Set<string>()
    await reconcileLegacyDocumentUploadStages({ ...stage, attemptedPaths })
    await reconcileLegacyDocumentUploadStages({ ...stage, attemptedPaths })
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([path])
    expect(mocks.rpc.mock.calls.some(call => call[0] === "finish_legacy_document_stage_cleanup")).toBe(false)
  })
})
