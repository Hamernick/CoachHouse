import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Database } from "@/lib/supabase"
import { preparePageDocument, PUBLIC_DOCUMENT_LIMIT } from "@/features/workspace-sharing/server/page-asset-document"
import { resolvePageDocumentSources } from "@/features/workspace-sharing/server/page-document-sources"
import { createFileParticle } from "@/features/workspace-particles/lib/particle-file"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), rows: vi.fn(), download: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", () => ({ loadPageActor: mocks.actor }))
const supabase = createClient<Database>("https://fixture.invalid", "fixture")
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ storage: supabase.storage }) }))
vi.mock("@/lib/organization/private-storage-link", () => ({ assertPrivateOrganizationReadWindow: vi.fn().mockResolvedValue(undefined) }))
const actor = { supabase, actorId: WORKSPACE, orgId: WORKSPACE }
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(), abortSignal: mocks.rows }
const from = vi.spyOn(supabase, "from").mockImplementation(vi.fn().mockReturnValue(query))
const bucket = supabase.storage.from("org-documents")
vi.spyOn(bucket, "download").mockImplementation(mocks.download)
const storage = vi.spyOn(supabase.storage, "from").mockReturnValue(bucket)

const document = (id = 1, fileId = ID(40)) => createFileParticle(WORKSPACE, "Selected document", {
  kind: "document", fileId, format: "txt", name: "Guide.txt", size: 20,
}, { x: 0, y: 0 }, ID(id), NOW)
const input = () => ({ graph: graph([document()]), draft: { title: "", description: "", particleIds: [ID(1)] } })
let bytes: Buffer
const row = () => ({ id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null,
  mime_type: "text/plain", size_bytes: bytes.length, storage_path: `${WORKSPACE}/library/guide.txt`, updated_at: NOW })

beforeEach(() => {
  vi.clearAllMocks()
  bytes = Buffer.from("Complete reviewed document — 日本語")
  mocks.actor.mockResolvedValue(actor)
  mocks.rows.mockResolvedValue({ data: [row()], error: null })
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null })
})

describe("complete inert document representation", () => {
  it("preserves every UTF-8 byte, markup, formulas and international text without interpreting them", () => {
    const bytes = Buffer.from('\ufeff# Guide\r\n<script>alert(1)</script>\n[link](https://example.org)\n=IMPORTXML("https://example.org")\n日本語 — العربية')
    const result = preparePageDocument(bytes, "text/markdown")
    expect(result.bytes).toEqual(bytes)
    expect(result.sha256).toBe(createHash("sha256").update(bytes).digest("hex"))
  })
  it("rejects unsupported MIME, invalid UTF-8, binary, empty and oversized input without truncation", () => {
    for (const [bytes, mime] of [[Buffer.from("PDF"), "application/pdf"], [Buffer.from([0xc3, 0x28]), "text/plain"],
      [Buffer.from("a\0b"), "text/plain"], [Buffer.alloc(0), "text/plain"], [Buffer.alloc(PUBLIC_DOCUMENT_LIMIT + 1, 65), "text/plain"]] as const)
      expect(() => preparePageDocument(bytes, mime)).toThrow()
  })
})

describe("selected private document source preparation", () => {
  it("rejects unsupported formats and missing canonical file identity before any file read", async () => {
    for (const widget of [
      { kind: "document" as const, format: "pdf" as const, name: "Private.pdf", fileId: ID(40), size: 20 },
      { kind: "document" as const, format: "txt" as const, name: "Missing.txt", size: 20 },
    ]) {
      const request = input()
      const candidate = document()
      if (candidate.type !== "activity") throw new Error("Fixture activity required")
      candidate.data.widget = widget
      request.graph = graph([candidate])
      await expect(resolvePageDocumentSources(actor, request)).rejects.toMatchObject({ code: widget.fileId ? "unsupported" : "invalid" })
    }
    expect(storage).not.toHaveBeenCalled()
  })

  it("uses session RLS and canonical paths, rechecks authority and metadata, and deduplicates file reads", async () => {
    const request = input()
    request.graph = graph([document(), document(2), document(3, ID(41))])
    request.draft.particleIds = [ID(1), ID(2)]
    const result = await resolvePageDocumentSources(actor, request)
    expect([...result.keys()]).toEqual([ID(1), ID(2)])
    expect(result.get(ID(1))?.representation).toBe(result.get(ID(2))?.representation)
    expect(query.eq).toHaveBeenCalledWith("org_id", WORKSPACE)
    expect(query.in).toHaveBeenCalledWith("id", [ID(40)])
    expect(query.is).toHaveBeenCalledWith("deleted_at", null)
    expect(storage).toHaveBeenCalledWith("org-documents")
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(row().storage_path, undefined, { signal: expect.any(AbortSignal) })
    expect(mocks.rows).toHaveBeenCalledTimes(2)
    expect(mocks.actor).toHaveBeenCalledTimes(2)
  })
  it("never reads unselected files or missing selections", async () => {
    const request = input()
    request.draft.particleIds = []
    expect((await resolvePageDocumentSources(actor, request)).size).toBe(0)
    request.draft.particleIds = [ID(99)]
    await expect(resolvePageDocumentSources(actor, request)).rejects.toMatchObject({ code: "conflict" })
    expect(from).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
  })
  it.each([
    { org_id: ID(555) }, { id: ID(555) }, { deleted_at: NOW }, { document_kind: "private" },
    { storage_path: `${WORKSPACE}/library/../secret.png` }, { storage_path: `${WORKSPACE}/library/%2e%2e/secret.png` },
    { storage_path: `${ID(555)}/library/photo.png` }, { mime_type: "document/svg+xml" },
    { size_bytes: PUBLIC_DOCUMENT_LIMIT + 1 },
  ])("rejects inaccessible or invalid source metadata before storage: %j", async (override) => {
    mocks.rows.mockResolvedValue({ data: [{ ...row(), ...override }], error: null })
    await expect(resolvePageDocumentSources(actor, input())).rejects.toBeInstanceOf(Error)
    expect(storage).not.toHaveBeenCalled()
  })
  it("rejects the whole preparation on missing files, duplicate rows and lookup errors", async () => {
    for (const response of [{ data: [], error: null }, { data: [row(), row()], error: null }, { data: null, error: { message: "private" } }]) {
      mocks.rows.mockResolvedValue(response)
      await expect(resolvePageDocumentSources(actor, input())).rejects.toMatchObject({ code: "unavailable" })
    }
    expect(storage).not.toHaveBeenCalled()
  })
  it("rejects download errors and size mismatches", async () => {
    for (const response of [{ data: null, error: { message: "private" } }, { data: new Blob(["wrong"]), error: null }]) {
      mocks.download.mockResolvedValue(response)
      await expect(resolvePageDocumentSources(actor, input())).rejects.toMatchObject({ code: "unavailable" })
    }
  })
  it("rejects changed source evidence after download", async () => {
    mocks.rows.mockResolvedValueOnce({ data: [row()], error: null })
      .mockResolvedValueOnce({ data: [{ ...row(), updated_at: "2026-11-01T12:00:00Z" }], error: null })
    await expect(resolvePageDocumentSources(actor, input())).rejects.toMatchObject({ code: "conflict" })
  })
  it("rejects revocation and organization switching during preparation", async () => {
    mocks.actor.mockResolvedValueOnce(actor).mockRejectedValueOnce(new Error("Access revoked"))
    await expect(resolvePageDocumentSources(actor, input())).rejects.toThrow("Access revoked")
    mocks.actor.mockResolvedValue({ ...actor, orgId: ID(555) })
    await expect(resolvePageDocumentSources(actor, input())).rejects.toMatchObject({ code: "scope" })
  })
  it("bounds distinct selected documents before any source access", async () => {
    const particles = Array.from({ length: 9 }, (_, i) => document(i + 1, ID(i + 40)))
    await expect(resolvePageDocumentSources(actor, { graph: graph(particles), draft: {
      title: "", description: "", particleIds: particles.map(({ id }) => id),
    } })).rejects.toMatchObject({ code: "unsupported" })
    expect(from).not.toHaveBeenCalled()
  })
})
