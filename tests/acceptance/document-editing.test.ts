import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { documentSourceSchema, documentSnapshotSchema, decodeCompleteDocument, DOCUMENT_EDIT_BYTES } from "@/features/document-editing/lib/contracts"
import { createMarkdownAdapter } from "@/features/document-editing/lib/markdown-adapter"
import { createDocumentReplica } from "@/features/document-editing/lib/document-replica"
import { documentCollaborationExtensions } from "@/features/document-editing/lib/document-collaboration"
import { readCompleteBytes, readLocalDocument } from "@/features/document-editing/server/read-local-document"
import { createLinkPreviewQueue } from "@/lib/editor/link-preview-queue"

const ORG = "00000000-0000-4000-8000-000000000001"
const FILE = "00000000-0000-4000-8000-000000000002"
const source = { provider: "coach_house" as const, organizationId: ORG, fileId: FILE }
const url = (index: number) => `https://example.test/${index}`

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("complete document contracts", () => {
  it("distinguishes canonical attachment IDs from provider file IDs", () => {
    expect(documentSourceSchema.safeParse({ provider: "google_drive", organizationId: ORG, attachmentId: FILE }).success).toBe(true)
    expect(documentSourceSchema.safeParse({ provider: "google_drive", organizationId: ORG, attachmentId: "raw-google-file-id" }).success).toBe(false)
    expect(documentSourceSchema.safeParse({ ...source, storagePath: "private/path" }).success).toBe(false)
  })
  it("retains BOM, empty content and text beyond preview limits", () => {
    const content = "\uFEFF" + "hello ".repeat(25000) + "end"
    expect(decodeCompleteDocument(new TextEncoder().encode(content))).toBe(content)
    expect(decodeCompleteDocument(new Uint8Array())).toBe("")
  })
  it("rejects oversize and invalid UTF-8 instead of silently truncating", () => {
    expect(() => decodeCompleteDocument(new Uint8Array(DOCUMENT_EDIT_BYTES + 1))).toThrow("editing limit")
    expect(() => decodeCompleteDocument(new Uint8Array([0xff]))).toThrow("valid UTF-8")
  })
  it("cannot turn a read capability into a shared save capability", () => {
    const snapshot = { source, name: "notes.md", format: "markdown", revision: "r1", updatedAt: "2026-10-14T00:00:00Z", content: "", collaboration: { state: "unavailable", canCommit: false } }
    expect(documentSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(documentSnapshotSchema.safeParse({ ...snapshot, collaboration: { state: "unavailable", canCommit: true } }).success).toBe(false)
    expect(documentSnapshotSchema.safeParse({ ...snapshot, collaboration: { state: "ready", canCommit: true } }).success).toBe(false)
  })
  it("bounds actual streamed bytes without trusting Content-Length", async () => {
    const canceled = vi.fn()
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(DOCUMENT_EDIT_BYTES)); controller.enqueue(new Uint8Array(1)) }, cancel: canceled })
    await expect(readCompleteBytes(new Response(stream))).rejects.toThrow("editing limit")
    expect(canceled).toHaveBeenCalledOnce()
    expect(new TextDecoder().decode(await readCompleteBytes(new Response("complete")))).toBe("complete")
  })
})

describe("Markdown format probe", () => {
  const adapter = createMarkdownAdapter()
  it.each([
    "# Title\n\nA **bold**, *italic*, ~~struck~~ and `code` paragraph.",
    "###### Deep heading\n\n> Quoted\n\n---\n\n```typescript\nconst answer = 42\n```",
    "- One\n  - Nested\n- Two\n\n3. Three\n4. Four",
    "[Website](https://example.test)\n\n![Photo](https://example.test/photo.png)",
    "| Name | Value |\n| --- | --- |\n| First | 001 |",
  ])("round-trips supported structure: %s", (fixture) => {
    const document = adapter.parse(fixture)
    expect(adapter.parse(adapter.serialize(document))).toEqual(document)
  })
  it.each(["<script>alert(1)</script>", "- [x] Complete", "A footnote[^a]\n\n[^a]: Keep this"]) ("does not silently drop unsupported source syntax: %s", (fixture) => {
    expect(() => adapter.parse(fixture)).toThrow("original is unchanged")
  })
  it("rejects edits with unsupported marks or table merges", () => {
    expect(() => adapter.serialize({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "underlined", marks: [{ type: "underline" }] }] }] })).toThrow("saved faithfully")
    const document = adapter.parse("| A | B |\n|---|---|\n|a|b|")
    const cell = document.content?.[0].content?.[0].content?.[0]
    if (!cell) throw new Error("Missing table fixture")
    cell.attrs = { ...cell.attrs, colspan: 2 }
    expect(() => adapter.serialize(document)).toThrow("saved faithfully")
  })
})

function seededReplicas() {
  const seed = new Y.Doc()
  seed.getText("test").insert(0, "Start")
  const state = Y.encodeStateAsUpdate(seed)
  seed.destroy()
  return [createDocumentReplica(state), createDocumentReplica(state)] as const
}

describe("document CRDT and durable outbox", () => {
  it("merges simultaneous edits and repeated/out-of-order delivery without duplication or echo", () => {
    const [a, b] = seededReplicas()
    a.document.getText("test").insert(5, " A")
    b.document.getText("test").insert(5, " B")
    const left = a.prepare()!, right = b.prepare()!
    a.receive(right.update); a.receive(right.update)
    b.receive(left.update); b.receive(left.update)
    expect(a.document.getText("test").toString()).toBe(b.document.getText("test").toString())
    expect(a.document.getText("test").toString()).toContain(" A")
    expect(a.document.getText("test").toString()).toContain(" B")
    a.acknowledge(left.id); b.acknowledge(right.id)
    expect(a.prepare()).toBeNull(); expect(b.prepare()).toBeNull()
    a.dispose(); b.dispose()
  })
  it("retains failed batches and edits arriving while persistence is in flight", () => {
    const [a, b] = seededReplicas()
    a.document.getText("test").insert(5, " first")
    const batch = a.prepare()!
    const retried = a.prepare()!
    expect(retried).toEqual(batch)
    // A transport must not be able to mutate the retained retry buffer.
    retried.update[0] ^= 0xff
    expect(a.prepare()).toEqual(batch)
    a.document.getText("test").insert(5, " second")
    expect(a.acknowledge(batch.id + 1)).toBe(false)
    expect(() => a.dispose()).toThrow("Persist or recover")
    expect(a.acknowledge(batch.id)).toBe(true)
    const later = a.prepare()!
    b.receive(later.update); b.receive(batch.update)
    expect(b.document.getText("test").toString()).toBe(a.document.getText("test").toString())
    a.acknowledge(later.id); a.dispose(); b.dispose()
  })
  it("reconnects using missing state and keeps undo scoped to local edits", () => {
    const [a, b] = seededReplicas()
    const local = Symbol("local")
    const undo = new Y.UndoManager(a.document.getText("test"), { trackedOrigins: new Set([local]) })
    a.document.transact(() => a.document.getText("test").insert(5, " A"), local)
    b.document.getText("test").insert(5, " B")
    a.receive(Y.encodeStateAsUpdate(b.document, Y.encodeStateVector(a.document)))
    undo.undo()
    expect(a.document.getText("test").toString()).not.toContain(" A")
    expect(a.document.getText("test").toString()).toContain(" B")
    b.receive(Y.encodeStateAsUpdate(a.document, Y.encodeStateVector(b.document)))
    expect(a.document.getText("test").toString()).toBe(b.document.getText("test").toString())
    const ab = a.prepare(), bb = b.prepare()
    if (ab) a.acknowledge(ab.id)
    if (bb) b.acknowledge(bb.id)
    undo.destroy(); a.dispose(); b.dispose()
  })
  it("binds the existing editor to the shared fragment and rejects malformed checkpoints", () => {
    const [a, b] = seededReplicas()
    const [extension] = documentCollaborationExtensions(a.document)
    expect(extension.name).toBe("collaboration")
    expect(extension.options.field).toBe("content")
    expect(extension.options.document).toBe(a.document)
    expect(() => createDocumentReplica(new Uint8Array([255]))).toThrow("invalid")
    a.dispose(); b.dispose()
  })
})

describe("file-session link previews", () => {
  beforeEach(() => vi.useFakeTimers())
  it("retains previews while deduplicating unchanged URLs", async () => {
    const fetchPreview = vi.fn(async () => Response.json({ title: "Title" }))
    const onResult = vi.fn()
    const queue = createLinkPreviewQueue({ fetchPreview, onResult })
    queue.update([url(1), url(1)], true)
    await vi.advanceTimersByTimeAsync(0)
    queue.update([url(1)], true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPreview).toHaveBeenCalledOnce()
    expect(onResult).toHaveBeenCalledWith(url(1), { title: "Title" })
    queue.dispose()
  })
  it("bounds concurrency and total attempts", async () => {
    const releases: Array<() => void> = []
    const fetchPreview = vi.fn(() => new Promise<Response>((resolve) => releases.push(() => resolve(Response.json({})))) )
    const queue = createLinkPreviewQueue({ fetchPreview, onResult: vi.fn(), requestBudget: 5 })
    queue.update(Array.from({ length: 20 }, (_, i) => url(i)), true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPreview).toHaveBeenCalledTimes(3)
    releases.splice(0).forEach((release) => release())
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPreview).toHaveBeenCalledTimes(5)
    releases.splice(0).forEach((release) => release())
    await vi.advanceTimersByTimeAsync(0)
    queue.update([url(19)], true)
    expect(fetchPreview).toHaveBeenCalledTimes(5)
    queue.dispose()
  })
  it("aborts hidden-view work and resumes without emitting late data", async () => {
    const signals: AbortSignal[] = []
    const releases: Array<() => void> = []
    const onResult = vi.fn()
    const queue = createLinkPreviewQueue({ fetchPreview: vi.fn((_url, signal) => { signals.push(signal); return new Promise<Response>((resolve) => releases.push(() => resolve(Response.json({ title: "old" })))) }), onResult })
    queue.update([url(1)], true)
    await vi.advanceTimersByTimeAsync(0)
    queue.update([url(1)], false)
    expect(signals[0].aborted).toBe(true)
    releases.shift()?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(onResult).not.toHaveBeenCalled()
    queue.update([url(1)], true)
    await vi.advanceTimersByTimeAsync(0)
    expect(signals).toHaveLength(2)
    queue.dispose()
    releases.shift()?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(onResult).not.toHaveBeenCalled()
  })
  it("stops an unavailable provider instead of retrying every discovered link", async () => {
    const fetchPreview = vi.fn(async () => new Response(null, { status: 410 }))
    const queue = createLinkPreviewQueue({ fetchPreview, onResult: vi.fn() })
    queue.update(Array.from({ length: 20 }, (_, i) => url(i)), true)
    await vi.advanceTimersByTimeAsync(0)
    queue.update([url(21)], true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchPreview).toHaveBeenCalledTimes(3)
    queue.dispose()
  })
  it("times out once without a background retry loop", async () => {
    const fetchPreview = vi.fn((_url: string, signal: AbortSignal) => new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })))
    const queue = createLinkPreviewQueue({ fetchPreview, onResult: vi.fn() })
    queue.update([url(1)], true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchPreview).toHaveBeenCalledOnce()
    queue.update([url(1)], true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchPreview).toHaveBeenCalledOnce()
    queue.dispose()
  })
  it("does not request unsafe schemes or trust malformed provider metadata", async () => {
    const onResult = vi.fn()
    const fetchPreview = vi.fn(async () => Response.json({ image: "javascript:alert(1)" }))
    const queue = createLinkPreviewQueue({ fetchPreview, onResult })
    queue.update(["javascript:alert(1)", "mailto:a@example.test", url(1)], true)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchPreview).toHaveBeenCalledOnce()
    expect(onResult).toHaveBeenCalledWith(url(1), {})
    queue.dispose()
  })
})

describe("authorized canonical source reads", () => {
  function client(row = { name: "notes.md", mime_type: "text/markdown", size_bytes: 10, storage_path: `${ORG}/library/source.md`, updated_at: "2026-10-14T00:00:00Z", deleted_at: null as string | null }) {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), abortSignal:vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: row, error: null })) }
    const sign = vi.fn(async () => ({ data: { signedUrl: "https://storage.example.test/private" }, error: null }))
    const supabase = { from: vi.fn(() => query), storage: { from: vi.fn(() => ({ createSignedUrl: sign })) } } as unknown as SupabaseClient<Database>
    return { supabase, query, sign }
  }
  it("loads all content through scoped private storage without enabling writes", async () => {
    const { supabase, query, sign } = client()
    const text = "Full content ".repeat(15000)
    const fetcher = vi.fn(async () => new Response(text))
    vi.stubGlobal("fetch", fetcher)
    const result = await readLocalDocument(supabase, source)
    expect(query.eq).toHaveBeenCalledWith("org_id", ORG)
    expect(query.eq).toHaveBeenCalledWith("id", FILE)
    expect(sign).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledOnce()
    expect(result.content).toBe(text)
    expect(result.collaboration).toEqual({ state: "unavailable", canCommit: false })
    expect(result.revision).not.toContain("library")
  })
  it("does not sign a deleted, foreign-path or oversized source", async () => {
    for (const change of [{ deleted_at: "2026-10-14" }, { storage_path: "other/library/private.md" }, { size_bytes: DOCUMENT_EDIT_BYTES + 1 }]) {
      const fixture = client()
      fixture.query.maybeSingle.mockResolvedValue({ data: { name: "notes.md", mime_type: "text/markdown", size_bytes: 10, storage_path: `${ORG}/library/source.md`, updated_at: "2026-10-14T00:00:00Z", deleted_at: null, ...change }, error: null })
      await expect(readLocalDocument(fixture.supabase, source)).rejects.toThrow()
      expect(fixture.sign).not.toHaveBeenCalled()
    }
  })
})
