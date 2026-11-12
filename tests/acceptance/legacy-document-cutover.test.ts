import { beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const mocks = vi.hoisted(() => ({ admin: vi.fn(), upload: vi.fn(), reconcile: vi.fn(), mutation: vi.fn(), readable: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }))
vi.mock("@/lib/organization/legacy-document-upload-stage", () => ({ uploadLegacyDocumentStage: mocks.upload, reconcileLegacyDocumentUploadStages: mocks.reconcile }))
vi.mock("@/lib/organization/profile-mutation", () => ({ mutateOrganizationProfile: mocks.mutation }))
vi.mock("@/lib/organization/legacy-document-bindings", async original => ({ ...await original<object>(), readableLegacyDocumentBindings: mocks.readable }))
import { captureLegacyCutoverRecovery, readLegacyCutoverSource, replaceLegacyDocumentFromRecovery } from "@/lib/organization/legacy-document-cutover"

const orgId = "00000000-0000-4000-8000-000000000001"
const fileId = "00000000-0000-4000-8000-000000000002"
const bytes = Buffer.from("exact original fixture bytes")
let profile: Record<string, any>, kind: string, canonical: Record<string, unknown>, objects: Map<string, Buffer>
let user: string | null
const doc = () => kind.startsWith("policy:") ? profile.policies[0].document : profile.documents[kind]
const client = {
  auth: { getUser: async () => ({ error: null, data: { user: user ? { id: user } : null } }) },
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, single: async () => ({ error: null, data: structuredClone(table === "organizations" ? { profile } : canonical) }) }
    return query
  },
} as any
const scope = () => ({ supabase: client, orgId, documentKind: kind })
function seed(policy = false) {
  kind = policy ? "policy:board" : "w9"
  const path = `${orgId}/${policy ? "policies/board" : "w9"}/old.pdf`
  const document = { path, name: "Original", mime: "application/pdf", size: bytes.length, updatedAt: "2026-11-11T00:00:00Z", custom: { preserve: true } }
  profile = { untouched: { answer: 42 }, documents: policy ? {} : { w9: document }, policies: policy ? [{ id: "board", title: "Keep", document, extra: true }] : [] }
  canonical = { id: fileId, org_id: orgId, document_kind: kind, storage_path: path, size_bytes: bytes.length, deleted_at: null }
  objects = new Map([[path, bytes]])
}
beforeEach(() => {
  vi.clearAllMocks(); seed(); user = orgId
  mocks.readable.mockImplementation(async () => new Map([[kind, { id: fileId, path: doc().path }]]))
  mocks.admin.mockReturnValue({ storage: { from: () => ({ download: async (path: string) => objects.has(path)
    ? { error: null, data: new Blob([objects.get(path)!]) } : { error: Error("missing"), data: null } }) } })
  mocks.upload.mockImplementation(async (stage, body) => { objects.set(stage.path, Buffer.from(body)) })
  mocks.mutation.mockImplementation(async ({ mutate }) => {
    const result = mutate(structuredClone(profile))
    if (result.error) return result
    profile = result.nextProfile; canonical.storage_path = doc().path
    return { ok: true, value: null }
  })
})

describe("legacy cutover preparation and forward recovery", () => {
  it.each([false, true])("replaces and recovers exact bytes/metadata at fresh paths for policy=%s", async policy => {
    seed(policy)
    const before = structuredClone(profile)
    const recovery = await captureLegacyCutoverRecovery(scope())
    const directory = await mkdtemp(join(tmpdir(), "ch-cutover-recovery-"))
    try {
      await writeFile(join(directory, "bytes"), recovery.bytes, { mode: 0o600, flag: "wx" })
      await writeFile(join(directory, "snapshot.json"), JSON.stringify({ ...recovery, bytes: undefined }), { mode: 0o600, flag: "wx" })
      const readRecovery = async () => ({ ...JSON.parse(await readFile(join(directory, "snapshot.json"), "utf8")), bytes: await readFile(join(directory, "bytes")) })
      const prepared = await replaceLegacyDocumentFromRecovery({ supabase: client, expected: recovery.source, readRecovery })
      expect(prepared.activationAllowed).toBe(false)
      expect(prepared.current.fileId).toBe(fileId)
      expect(prepared.current.document.path).not.toBe(recovery.source.document.path)
      expect(objects.get(prepared.current.document.path)).toEqual(bytes)
      expect(objects.get(recovery.source.document.path)).toEqual(bytes) // preparation does not remove outgoing bytes
      objects.delete(prepared.current.document.path) // controlled failure, after independent backup readback
      const restored = await replaceLegacyDocumentFromRecovery({ supabase: client, expected: prepared.current, readRecovery })
      expect(restored.current.fileId).toBe(fileId)
      expect(objects.get(restored.current.document.path)).toEqual(bytes)
      expect(restored.current.document.path).not.toBe(prepared.current.document.path)
      doc().path = recovery.source.document.path
      expect(profile).toEqual(before)
      expect(mocks.reconcile).toHaveBeenCalledTimes(2)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it.each(["bytes", "hash", "identity", "metadata", "foreign-path"])("rejects %s corruption before upload", async mode => {
    const recovery = await captureLegacyCutoverRecovery(scope()); const expected = structuredClone(recovery.source)
    if (mode === "bytes") recovery.bytes[0] ^= 1
    if (mode === "hash") recovery.sha256 = "0".repeat(64)
    if (mode === "identity") recovery.source.fileId = orgId
    if (mode === "metadata") recovery.source.document.name = "Earlier edit"
    if (mode === "foreign-path") recovery.source.document.path = "foreign/w9/file"
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected, readRecovery: async () => recovery })).rejects.toThrow()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("requires successful independent backup readback", async () => {
    const expected = await readLegacyCutoverSource(scope())
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected, readRecovery: async () => { throw Error("Backup unavailable") } })).rejects.toThrow("Backup unavailable")
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it.each(["before", "during"])("preserves concurrent source edits %s upload", async when => {
    const recovery = await captureLegacyCutoverRecovery(scope())
    const change = () => { doc().name = "Newer collaborator edit" }
    if (when === "before") change()
    else mocks.upload.mockImplementationOnce(async stage => { objects.set(stage.path, bytes); change() })
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected: recovery.source, readRecovery: async () => recovery })).rejects.toThrow("changed")
    expect(doc().name).toBe("Newer collaborator edit")
    expect(canonical.storage_path).toBe(recovery.source.document.path)
  })
  it("rejects replacement byte corruption before canonical commit", async () => {
    const recovery = await captureLegacyCutoverRecovery(scope())
    mocks.upload.mockImplementationOnce(async stage => objects.set(stage.path, Buffer.alloc(bytes.length)))
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected: recovery.source, readRecovery: async () => recovery })).rejects.toThrow("did not verify")
    expect(mocks.mutation).not.toHaveBeenCalled()
    expect(mocks.reconcile).toHaveBeenCalledTimes(1)
  })
  it("does not retry an uncertain committed write or clean the outgoing source", async () => {
    const recovery = await captureLegacyCutoverRecovery(scope())
    const commit = mocks.mutation.getMockImplementation()!
    mocks.mutation.mockImplementationOnce(async args => { await commit(args); throw Error("lost reply") })
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected: recovery.source, readRecovery: async () => recovery })).rejects.toThrow("lost reply")
    expect(mocks.mutation).toHaveBeenCalledTimes(1)
    expect(objects.get(doc().path)).toEqual(bytes)
    expect(objects.get(recovery.source.document.path)).toEqual(bytes)
    expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({ path: doc().path }))
  })
  it.each(["anonymous", "revoked", "ambiguous", "missing-bytes", "changed-during-capture"])("holds %s sources", async mode => {
    if (mode === "anonymous") user = null
    if (mode === "revoked") mocks.readable.mockResolvedValue(new Map())
    if (mode === "ambiguous") canonical.storage_path = `${orgId}/w9/different.pdf`
    if (mode === "missing-bytes") objects.clear()
    if (mode === "changed-during-capture") mocks.admin.mockReturnValue({ storage: { from: () => ({ download: async () => { doc().name = "Changed"; return { data: new Blob([bytes]), error: null } } }) } })
    await expect(captureLegacyCutoverRecovery(scope())).rejects.toThrow()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it("retains the original snapshot and never commits after authority is revoked", async () => {
    const recovery = await captureLegacyCutoverRecovery(scope())
    mocks.upload.mockRejectedValueOnce(Error("Forbidden"))
    await expect(replaceLegacyDocumentFromRecovery({ supabase: client, expected: recovery.source, readRecovery: async () => recovery })).rejects.toThrow("Forbidden")
    expect(doc()).toEqual(recovery.source.document)
    expect(mocks.mutation).not.toHaveBeenCalled()
  })
})
