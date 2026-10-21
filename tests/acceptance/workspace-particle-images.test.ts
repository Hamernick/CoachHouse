import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as images from "@/features/workspace-particles/lib/particle-image"
import {
  buildParticlePreset,
  PARTICLE_PRESETS,
  DEFAULT_PRESET_FIELDS,
} from "@/features/workspace-particles/lib/particle-presets"
import {
  fillImagePlaceholder,
  pendingParticleUploads,
} from "@/features/workspace-particles/lib/particle-upload-operations"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { duplicateParticle } from "@/features/workspace-particles/lib/particle-card-actions"
import { applyParticleBatch } from "@/features/workspace-particles/lib/graph-operations"
import { filterParticleLibrary } from "@/features/workspace-particles/lib/particle-library"
import { ParticleCard } from "@/features/workspace-particles/components/particle-card"
import { ParticleLibrary } from "@/features/workspace-particles/components/particle-library"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { useParticleImageUpload } from "@/features/workspace-particles/hooks/use-particle-image-upload"
import {
  useParticleSession,
  type ParticleTransport,
} from "@/features/workspace-particles/hooks/use-particle-session"
import { batch, graph, ID, NOW, WORKSPACE } from "./fixtures/particle-fixtures"

vi.mock("@/lib/toast", () => ({
  toast: { loading: vi.fn(() => "upload"), error: vi.fn(), success: vi.fn() },
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const image: images.ParticleImage = {
  kind: "image",
  fileId: ID(50),
  width: 1600,
  height: 900,
  alt: "A green valley",
}
const imageParticle = () =>
  images.createImageParticle(
    WORKSPACE,
    "Scenic Valley",
    image,
    { x: 200, y: 100 },
    ID(1),
    NOW
  )

describe("Particle image data and uploads", () => {
  it("stores a durable private file reference, never a signed URL", () => {
    const particle = imageParticle()
    expect(particleSchema.safeParse(particle).success).toBe(true)
    expect(images.getParticleImage(particle)).toEqual(image)
    expect(particle.type).toBe("activity")
    expect(images.imageFileEndpoint(WORKSPACE, ID(50))).toBe(
      `/api/account/organization-document-files?organizationId=${WORKSPACE}&id=${ID(50)}`
    )
    if (particle.type !== "activity") throw new Error("Fixture type")
    expect(
      particleSchema.safeParse({
        ...particle,
        data: {
          ...particle.data,
          widget: { ...image, url: "https://example.com/private?token=secret" },
        },
      }).success
    ).toBe(false)
    expect(
      particleSchema.safeParse({
        ...particle,
        data: { ...particle.data, widget: { ...image, width: 0 } },
      }).success
    ).toBe(false)
  })
  it("preserves uncapped portrait and panoramic aspect ratios in the card", () => {
    for (const [width, height] of [
      [300, 3000],
      [3000, 300],
    ]) {
      const particle = images.createImageParticle(
        WORKSPACE,
        "Photo",
        { ...image, width, height },
        { x: 0, y: 0 },
        ID(1),
        NOW
      )
      const html = renderToStaticMarkup(
        createElement(ParticleCard, {
          data: { particle, editable: false, onOpen: vi.fn(), onEdit: vi.fn() },
          selected: false,
        })
      )
      expect(html).toContain(`aspect-ratio:${width / height}`)
      expect(html).toContain("height:36px")
    }
  })
  it("rejects unsupported, empty and oversized files before upload", () => {
    expect(
      images.particleImageFileError({ type: "image/svg+xml", size: 20 })
    ).toContain("JPEG")
    expect(
      images.particleImageFileError({ type: "image/png", size: 0 })
    ).toContain("empty")
    expect(
      images.particleImageFileError({
        type: "image/png",
        size: 16 * 1024 * 1024,
      })
    ).toContain("15 MB")
    expect(
      images.particleImageFileError({ type: "image/webp", size: 100 })
    ).toBeNull()
    expect(images.imageFileTitle("Scenic.Valley.PNG")).toBe("Scenic.Valley")
  })
  it("decodes and uploads through the existing scoped document endpoint, revoking local object URLs", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:temporary")
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 1600
        naturalHeight = 900
        onload: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      }
    )
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ file: { id: ID(50) } }))
    )
    vi.stubGlobal("fetch", fetcher)
    const file = new File(["image"], "Valley.png", { type: "image/png" })
    expect(await images.uploadParticleImage(WORKSPACE, file)).toEqual({
      ...image,
      alt: "",
    })
    expect(fetcher).toHaveBeenCalledWith(
      images.imageFileEndpoint(WORKSPACE),
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    )
    expect(revoke).toHaveBeenCalledWith("blob:temporary")
  })
  it("surfaces authorization and unavailable-file errors without inventing a URL", async () => {
    await expect(
      images.readImageResponse(
        new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
      )
    ).rejects.toThrow("Forbidden")
    await expect(
      images.readImageResponse(new Response("{}", { status: 404 }))
    ).rejects.toThrow("Unable to load")
  })
  it("duplicates the reference without copying the file and keeps image addition undoable", async () => {
    const particle = imageParticle()
    const copy = duplicateParticle(particle, () => ID(2), NOW)
    expect(images.getParticleImage(copy)?.fileId).toBe(ID(50))
    const saved = await applyParticleBatch(
      graph([]),
      batch(100, [{ kind: "put_particle", particle, expectedRevision: null }]),
      NOW
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const undone = await applyParticleBatch(
      saved.value.graph,
      batch(101, saved.value.inverse, saved.value.graph.revision),
      NOW
    )
    expect(undone.ok && undone.value.graph.particles).toEqual([])
    expect(filterParticleLibrary([particle], "image")).toEqual([])
  })
})

describe("Image presentation and save retry", () => {
  it("renders just the image region, title and shared action button", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleCard, {
        data: {
          particle: imageParticle(),
          editable: true,
          onEdit: vi.fn(),
          onOpen: vi.fn(),
        },
      })
    )
    expect(html).toContain("Scenic Valley</figcaption>")
    expect(html).toContain("aspect-ratio:")
    expect(html).toContain('aria-label="Actions for Scenic Valley"')
    for (const text of ["Backlog", "Open details", "Activity", "2026-10-10"])
      expect(html).not.toContain(text)
  })
  it("offers one reusable image tool while hiding uploaded images from the library", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleLibrary, {
        workspaceId: WORKSPACE,
        externalQuery: "image",
        particles: [
          imageParticle(),
          { ...imageParticle(), id: ID(2), canvasHidden: true },
        ],
        editable: true,
        canEdit: true,
        pending: false,
        error: null,
        onCreate: vi.fn(async () => true),
        onRetry: vi.fn(),
        onAddPreset: vi.fn(async () => true),
        images: {
          upload: vi.fn(async () => true),
          retry: vi.fn(async () => true),
          canRetry: false,
          pending: false,
          message: null,
        },
      })
    )
    expect(html).not.toContain('aria-label="Add files"')
    expect(html).not.toContain("No matches")
    expect(html.match(/aria-label="Add Image to canvas"/g)).toHaveLength(1)
    expect(html).not.toContain("Scenic Valley")
    expect(html).not.toContain("Configure Image")
    expect(html).not.toContain('type="search"')
  })
  it("keeps the image inspector minimal", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleInspector, {
        particle: imageParticle(),
        editable: true,
        pending: false,
        onSave: vi.fn(async () => true),
        onClose: vi.fn(),
        onDirtyChange: vi.fn(),
      })
    )
    expect(html).toContain("Image description")
    expect(html).toContain("Replace image")
    expect(html).not.toContain("Checklist")
    expect(html).not.toContain(">Status<")
  })
  it("retries an interrupted graph save with the same uploaded files and operation identity", async () => {
    vi.stubGlobal("document", { querySelector: () => null })
    const upload = vi
      .spyOn(images, "uploadParticleImage")
      .mockResolvedValue(image)
    let persisted = graph([])
    let unavailable = true
    let needsRetry = false
    const transport = vi.fn<ParticleTransport>(async (request) => {
      if (unavailable) {
        needsRetry = true
        return { ok: false, code: "unavailable", error: "Offline" }
      }
      const result = await applyParticleBatch(persisted, request, NOW)
      if (result.ok) persisted = result.value.graph
      return result
    })
    let controller: ReturnType<typeof useParticleImageUpload> | undefined
    function Harness() {
      const session = useParticleSession({
        workspaceId: WORKSPACE,
        stored: persisted,
        canEdit: true,
        transport,
        load: async () => ({ ok: true, value: persisted }),
      })
      controller = useParticleImageUpload({
        session: {
          ...session,
          get error() {
            return needsRetry ? "Offline" : null
          },
        },
        dirty: { current: false },
        blocked: false,
        flush: async () => true,
        flow: { current: null },
      })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    if (!controller) throw new Error("Not mounted")
    expect(
      await controller.upload(
        [new File(["image"], "Valley.png", { type: "image/png" })],
        { x: 400, y: 200 }
      )
    ).toBe(false)
    unavailable = false
    expect(await controller.retry()).toBe(true)
    expect(upload).toHaveBeenCalledOnce()
    expect(transport.mock.calls[1][0]).toEqual(transport.mock.calls[0][0])
    expect(persisted.particles).toHaveLength(1)
    expect(persisted.particles[0].position).toEqual({ x: 400, y: 200 })
  })
})

function placeholder() {
  const preset = PARTICLE_PRESETS.find((item) => item.id === "image")
  if (!preset) throw new Error("Missing image tool")
  return {
    ...buildParticlePreset(preset, {
      id: ID(1),
      workspaceId: WORKSPACE,
      now: NOW,
      title: "Image",
      description: "",
      fields: DEFAULT_PRESET_FIELDS,
    }),
    position: { x: 80, y: 90 },
  }
}

describe("Reusable Image tool", () => {
  it("persists an empty image card without inventing a file reference", () => {
    const empty = placeholder()
    expect(particleSchema.safeParse(empty).success).toBe(true)
    expect(images.isImagePlaceholder(empty)).toBe(true)
    expect(images.getParticleImage(empty)).toBeNull()
    expect(filterParticleLibrary([empty], "")).toEqual([])
    const html = renderToStaticMarkup(
      createElement(ParticleCard, {
        data: {
          particle: empty,
          editable: true,
          onEdit: vi.fn(),
          onOpen: vi.fn(),
          onUploadImage: vi.fn(async () => true),
        },
      })
    )
    expect(html).toContain("Drop an image here")
    expect(html).toContain('aria-label="Choose image for this placeholder"')
    expect(html).not.toContain("Backlog")
  })
  it("fills the same card and preserves its position, size and undo", async () => {
    const empty = placeholder()
    const original = graph([empty])
    const operation = fillImagePlaceholder(empty, image, "Valley")
    expect(operation.expectedRevision).toBe(empty.revision)
    expect(operation.particle.id).toBe(empty.id)
    expect(operation.particle.position).toEqual(empty.position)
    expect(operation.particle.size).toBe(empty.size)
    expect(
      fillImagePlaceholder({ ...empty, title: "Cover" }, image, "Valley")
        .particle.title
    ).toBe("Cover")
    const filled = await applyParticleBatch(
      original,
      batch(100, [operation]),
      NOW
    )
    if (!filled.ok) throw new Error(filled.error)
    expect(filled.value.graph.particles).toHaveLength(1)
    expect(images.getParticleImage(filled.value.graph.particles[0])).toEqual(
      image
    )
    expect(
      pendingParticleUploads([operation], filled.value.graph.particles)
    ).toEqual([])
    const undone = await applyParticleBatch(
      filled.value.graph,
      batch(101, filled.value.inverse, filled.value.graph.revision),
      NOW
    )
    if (!undone.ok) throw new Error(undone.error)
    expect(images.isImagePlaceholder(undone.value.graph.particles[0])).toBe(
      true
    )
    expect(
      pendingParticleUploads([operation], [{ ...empty, revision: 2 }])
    ).toBeNull()
    expect(pendingParticleUploads([operation], [])).toBeNull()
    expect(() =>
      fillImagePlaceholder({ ...empty, locked: true }, image, "Valley")
    ).toThrow()
  })
  it("uploads into a placeholder, retries without uploading again, and keeps outside drops separate", async () => {
    vi.stubGlobal("document", { querySelector: () => null })
    const uploaded = vi
      .spyOn(images, "uploadParticleImage")
      .mockResolvedValue(image)
    let persisted = graph([placeholder()])
    let fail = true
    let needsRetry = false
    const transport: ParticleTransport = async (request) => {
      if (fail) {
        needsRetry = true
        return { ok: false, code: "unavailable", error: "Offline" }
      }
      needsRetry = false
      const result = await applyParticleBatch(persisted, request, NOW)
      if (result.ok) persisted = result.value.graph
      return result
    }
    let controller: ReturnType<typeof useParticleImageUpload> | undefined
    function Harness() {
      const session = useParticleSession({
        workspaceId: WORKSPACE,
        stored: persisted,
        canEdit: true,
        transport,
        load: async () => ({ ok: true, value: persisted }),
      })
      controller = useParticleImageUpload({
        session: {
          ...session,
          get error() {
            return needsRetry ? "Offline" : null
          },
        },
        dirty: { current: false },
        blocked: false,
        flush: async () => true,
        flow: { current: null },
      })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    if (!controller) throw new Error("Missing upload controller")
    const file = new File(["image"], "Valley.png", { type: "image/png" })
    expect(await controller.uploadToPlaceholder(ID(1), [file, file])).toBe(
      false
    )
    expect(uploaded).not.toHaveBeenCalled()
    expect(await controller.uploadToPlaceholder(ID(1), [file])).toBe(false)
    fail = false
    expect(await controller.retry()).toBe(true)
    expect(uploaded).toHaveBeenCalledOnce()
    expect(persisted.particles).toHaveLength(1)
    expect(persisted.particles[0].id).toBe(ID(1))
    expect(persisted.particles[0].position).toEqual({ x: 80, y: 90 })
    expect(await controller.upload([file], { x: 600, y: 300 })).toBe(true)
    expect(persisted.particles).toHaveLength(2)
    expect(persisted.particles[1].position).toEqual({ x: 600, y: 300 })
    expect(uploaded).toHaveBeenCalledTimes(2)
    expect(await controller.uploadToPlaceholder(ID(1), [file])).toBe(false)
    expect(uploaded).toHaveBeenCalledTimes(2)
  })
})
