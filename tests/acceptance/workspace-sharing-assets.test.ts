import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Database } from "@/lib/supabase"
import { preparePageImage, PUBLIC_IMAGE_INPUT_LIMIT } from "@/features/workspace-sharing/server/page-asset-image"
import { resolvePageImageSources } from "@/features/workspace-sharing/server/page-asset-sources"
import { createImageParticle } from "@/features/workspace-particles/lib/particle-image"
import { graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

const mocks = vi.hoisted(() => ({ actor: vi.fn(), rows: vi.fn(), download: vi.fn() }))
vi.mock("@/features/workspace-sharing/server/page-context", () => ({ loadPageActor: mocks.actor }))
const supabase = createClient<Database>("https://fixture.invalid", "fixture")
const actor = { supabase, actorId: WORKSPACE, orgId: WORKSPACE }
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(), abortSignal: mocks.rows }
const from = vi.spyOn(supabase, "from").mockImplementation(vi.fn().mockReturnValue(query))
const bucket = supabase.storage.from("org-documents")
vi.spyOn(bucket, "download").mockImplementation(mocks.download)
const storage = vi.spyOn(supabase.storage, "from").mockReturnValue(bucket)

const image = (id = 1, fileId = ID(40)) => createImageParticle(WORKSPACE, "Selected image", {
  kind: "image", fileId, width: 40, height: 20, alt: "Review image",
}, { x: 0, y: 0 }, ID(id), NOW)
const input = () => ({ graph: graph([image()]), draft: { title: "", description: "", particleIds: [ID(1)] } })
let bytes: Buffer
const row = () => ({ id: ID(40), org_id: WORKSPACE, document_kind: null, deleted_at: null,
  mime_type: "image/png", size_bytes: bytes.length, storage_path: `${WORKSPACE}/library/photo.png`, updated_at: NOW })

beforeEach(async () => {
  vi.clearAllMocks()
  bytes = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#269999" } }).png().toBuffer()
  mocks.actor.mockResolvedValue(actor)
  mocks.rows.mockResolvedValue({ data: [row()], error: null })
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null })
})

describe("bounded public image representation", () => {
  it.each(["jpeg", "png", "webp", "gif"] as const)("decodes static %s bytes and produces only bounded WebP", async (format) => {
    const source = await sharp(bytes).toFormat(format).toBuffer()
    const result = await preparePageImage(source, `image/${format}`)
    const decoded = await sharp(result.bytes).metadata()
    expect(decoded).toMatchObject({ format: "webp", width: 40, height: 20 })
    expect(result.sha256).toBe(createHash("sha256").update(result.bytes).digest("hex"))
    expect(result.mimeType).toBe("image/webp")
    expect((await preparePageImage(source, `image/${format}`)).bytes).toEqual(result.bytes)
  })
  it("applies orientation, bounds dimensions and removes identifying metadata", async () => {
    const source = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "red" } })
      .jpeg().withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Artist: "private photographer" }, IFD2: { UserComment: "private note" } }).toBuffer()
    expect((await sharp(source).metadata()).exif).toBeDefined()
    const result = await preparePageImage(source, "image/jpeg")
    const metadata = await sharp(result.bytes).metadata()
    expect(metadata).toMatchObject({ width: 1024, height: 2048 })
    for (const key of ["exif", "xmp", "icc", "iptc", "orientation"]) expect(metadata).not.toHaveProperty(key)
  })
  it("rejects SVG masquerading as PNG, MIME mismatch, corrupt and over-limit inputs", async () => {
    for (const [source, mime] of [
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), "image/png"],
      [bytes, "image/jpeg"], [Buffer.from("private corrupt payload"), "image/png"],
      [Buffer.alloc(0), "image/png"], [Buffer.alloc(PUBLIC_IMAGE_INPUT_LIMIT + 1), "image/png"],
    ] as const) await expect(preparePageImage(source, mime)).rejects.toMatchObject({ code: "unsupported" })
  })
  it.each(["gif", "webp"] as const)("rejects extra %s animation frames and excessive pixel dimensions", async (format) => {
    const frames = Buffer.from([...Array(4).fill([255, 0, 0, 255]).flat(), ...Array(4).fill([0, 0, 255, 255]).flat()])
    const animated = await sharp(frames, { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } })
      .toFormat(format, { delay: [100, 100], loop: 0 }).toBuffer()
    expect((await sharp(animated).metadata()).pages).toBe(2)
    await expect(preparePageImage(animated, `image/${format}`)).rejects.toMatchObject({ code: "unsupported" })
    const huge = await sharp({ create: { width: 20_001, height: 1, channels: 3, background: "red" } }).png().toBuffer()
    await expect(preparePageImage(huge, "image/png")).rejects.toMatchObject({ code: "unsupported" })
  })
})

describe("selected private image source preparation", () => {
  it("prepares a canonical primary logo with selected images and deduplicates its library read", async () => {
    const result = await resolvePageImageSources(actor, { ...input(), profile: {
      logoUrl: "https://private.example/never-fetch.png",
      brandIdentity: { assets: { "primary-logo": { fileId: ID(40) } } },
    } })
    expect([...result.keys()]).toEqual([ID(1), "brand-logo"])
    expect(result.get("brand-logo")?.representation).toBe(result.get(ID(1))?.representation)
    expect(mocks.download).toHaveBeenCalledTimes(1)
  })
  it("prepares logo-only review without inventing a Particle and rejects invalid logo identity", async () => {
    const request = { graph: graph(), draft: { title: "", description: "", particleIds: [] } }
    const result = await resolvePageImageSources(actor, { ...request, profile: { brandIdentity: { assets: { "primary-logo": { fileId: ID(40) } } } } })
    expect([...result.keys()]).toEqual(["brand-logo"])
    await expect(resolvePageImageSources(actor, { ...request, profile: { brandIdentity: { assets: { "primary-logo": { fileId: "https://private.example" } } } } })).rejects.toMatchObject({ code: "invalid" })
  })
  it("never falls back to a legacy URL or explicitly removed logo", async () => {
    for (const profile of [{ logoUrl: "https://private.example/logo.png" }, { brandIdentity: { assets: { "primary-logo": null } } }]) {
      const result = await resolvePageImageSources(actor, { graph: graph(), draft: { title: "", description: "", particleIds: [] }, profile })
      expect(result.size).toBe(0)
    }
    expect(storage).not.toHaveBeenCalled()
  })
  it("uses session RLS and canonical paths, rechecks authority and metadata, and deduplicates file reads", async () => {
    const request = input()
    request.graph = graph([image(), image(2), image(3, ID(41))])
    request.draft.particleIds = [ID(1), ID(2)]
    const result = await resolvePageImageSources(actor, request)
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
    expect((await resolvePageImageSources(actor, request)).size).toBe(0)
    request.draft.particleIds = [ID(99)]
    await expect(resolvePageImageSources(actor, request)).rejects.toMatchObject({ code: "conflict" })
    expect(from).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
  })
  it.each([
    { org_id: ID(555) }, { id: ID(555) }, { deleted_at: NOW }, { document_kind: "private" },
    { storage_path: `${WORKSPACE}/library/../secret.png` }, { storage_path: `${WORKSPACE}/library/%2e%2e/secret.png` },
    { storage_path: `${ID(555)}/library/photo.png` }, { mime_type: "image/svg+xml" },
    { size_bytes: PUBLIC_IMAGE_INPUT_LIMIT + 1 },
  ])("rejects inaccessible or invalid source metadata before storage: %j", async (override) => {
    mocks.rows.mockResolvedValue({ data: [{ ...row(), ...override }], error: null })
    await expect(resolvePageImageSources(actor, input())).rejects.toBeInstanceOf(Error)
    expect(storage).not.toHaveBeenCalled()
  })
  it("rejects the whole preparation on missing files, duplicate rows and lookup errors", async () => {
    for (const response of [{ data: [], error: null }, { data: [row(), row()], error: null }, { data: null, error: { message: "private" } }]) {
      mocks.rows.mockResolvedValue(response)
      await expect(resolvePageImageSources(actor, input())).rejects.toMatchObject({ code: "unavailable" })
    }
    expect(storage).not.toHaveBeenCalled()
  })
  it("rejects download errors and size mismatches", async () => {
    for (const response of [{ data: null, error: { message: "private" } }, { data: new Blob(["wrong"]), error: null }]) {
      mocks.download.mockResolvedValue(response)
      await expect(resolvePageImageSources(actor, input())).rejects.toMatchObject({ code: "unavailable" })
    }
  })
  it("rejects changed source evidence after download", async () => {
    mocks.rows.mockResolvedValueOnce({ data: [row()], error: null })
      .mockResolvedValueOnce({ data: [{ ...row(), updated_at: "2026-11-01T12:00:00Z" }], error: null })
    await expect(resolvePageImageSources(actor, input())).rejects.toMatchObject({ code: "conflict" })
  })
  it("rejects revocation and organization switching during preparation", async () => {
    mocks.actor.mockResolvedValueOnce(actor).mockRejectedValueOnce(new Error("Access revoked"))
    await expect(resolvePageImageSources(actor, input())).rejects.toThrow("Access revoked")
    mocks.actor.mockResolvedValue({ ...actor, orgId: ID(555) })
    await expect(resolvePageImageSources(actor, input())).rejects.toMatchObject({ code: "scope" })
  })
  it("bounds distinct selected images before any source access", async () => {
    const particles = Array.from({ length: 9 }, (_, i) => image(i + 1, ID(i + 40)))
    await expect(resolvePageImageSources(actor, { graph: graph(particles), draft: {
      title: "", description: "", particleIds: particles.map(({ id }) => id),
    } })).rejects.toMatchObject({ code: "unsupported" })
    expect(from).not.toHaveBeenCalled()
  })
})
