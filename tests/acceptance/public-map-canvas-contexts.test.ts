import type mapboxgl from "mapbox-gl"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getPublicMapMarkerImageBitmap,
  resetPublicMapMarkerBitmapCacheForTest,
} from "@/lib/public-map/public-map-marker-bitmap-cache"
import { createPublicMapFallbackMarkerImage as createDot } from "@/lib/public-map/public-map-marker-canvas"
import { createPublicMapFallbackMarkerImage as createPin } from "@/lib/public-map/public-map-pin-marker-canvas"
import { createPublicMapSpecialPillMarkerImage as createPill } from "@/lib/public-map/public-map-special-marker-canvas"
import { ensurePublicMapBadgeImages } from "@/lib/public-map/public-map-marker-static-images"
import {
  buildPublicMapClusterSignature,
  buildPublicMapClusterSprite,
} from "@/lib/public-map/public-map-cluster-sprites"

function installCanvasEnvironment(
  kind: "dom" | "offscreen",
  nullContext = false
) {
  const colors: string[] = []
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((text: string) => ({ width: text.length * 5 })),
    getImageData: vi.fn(
      (_x: number, _y: number, width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      })
    ),
    set fillStyle(color: string) {
      colors.push(color)
    },
  }
  const getContext = vi.fn(() => (nullContext ? null : context))
  const canvases: { width: number; height: number }[] = []
  const createElement = vi.fn(() => {
    const canvas = { width: 0, height: 0, getContext }
    canvases.push(canvas)
    return canvas
  })
  class TestOffscreenCanvas {
    getContext = getContext
    convertToBlob = vi.fn()
    constructor(
      public width: number,
      public height: number
    ) {
      canvases.push(this)
    }
  }
  vi.stubGlobal(
    "OffscreenCanvas",
    kind === "offscreen" ? TestOffscreenCanvas : undefined
  )
  // Offscreen rendering must also work in a worker without document.
  vi.stubGlobal("document", kind === "dom" ? { createElement } : undefined)
  vi.stubGlobal(
    "Path2D",
    class {
      constructor(_path?: string) {}
    }
  )
  return { context, colors, canvases, getContext, createElement }
}

const markerInput = {
  label: "Housing Help",
  primaryGroup: "housing",
  selected: false,
} as const
const signature = buildPublicMapClusterSignature({
  totalCount: 3,
  imageKeys: [],
  categoryKeys: ["housing"],
  zoom: 8,
})
const request = {
  imageKey: "canvas-regression",
  imageUrl: "https://example.com/logo.png",
  fallbackLabel: "Help",
}

function installBitmapDecoder() {
  const original = { width: 160, height: 80, close: vi.fn() }
  const normalized = { width: 576, height: 576, close: vi.fn() }
  const decode = vi
    .fn()
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(normalized)
  vi.stubGlobal("createImageBitmap", decode)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob(["logo"])))
  )
  return { original, normalized, decode }
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetPublicMapMarkerBitmapCacheForTest()
})

describe.each(["dom", "offscreen"] as const)(
  "public map %s canvas behavior",
  (kind) => {
    it("renders markers and cluster sprites at their existing backing sizes", () => {
      const { context, canvases, colors, getContext, createElement } =
        installCanvasEnvironment(kind)
      expect(createDot(markerInput)).toMatchObject({ width: 288, height: 288 })
      expect(createPin(markerInput)).toMatchObject({ width: 288, height: 288 })
      expect(
        createPin({ ...markerInput, selected: true, sameLocationCount: 3 })
      ).toMatchObject({ width: 288, height: 288 })
      expect(
        createPill({
          label: "Cooling Center",
          resourceCategory: "emergency_cooling_centers",
          selected: false,
        })
      ).toMatchObject({ width: 816, height: 304 })
      expect(buildPublicMapClusterSprite({ signature })).toMatchObject({
        key: signature.imageId,
        size: 64,
        pixelRatio: 3,
        image: { width: 192, height: 192 },
      })
      expect(canvases.map(({ width, height }) => [width, height])).toEqual([
        [288, 288],
        [288, 288],
        [288, 288],
        [816, 304],
        [192, 192],
      ])
      expect(getContext).toHaveBeenCalledTimes(5)
      expect(getContext).toHaveBeenCalledWith("2d", {
        willReadFrequently: true,
      })
      expect(context.scale).toHaveBeenCalledWith(4, 4)
      expect(context.scale).toHaveBeenCalledWith(3, 3)
      expect(colors).toContain("#f97316")
      expect(colors).toContain("#FFFFFF")
      expect(context.fillText).toHaveBeenCalledWith(
        "3",
        expect.any(Number),
        expect.any(Number)
      )
      expect(context.arc).toHaveBeenCalledWith(36, 35, 14, 0, Math.PI * 2)
      expect(context.arc).toHaveBeenCalledWith(36, 33, 16, 0, Math.PI * 2)
      expect(createElement).toHaveBeenCalledTimes(kind === "dom" ? 5 : 0)
    })

    it("registers static badges and shadows once with their existing pixel ratio", () => {
      installCanvasEnvironment(kind)
      const keys = new Set<string>()
      const addImage = vi.fn(
        (
          key: string,
          _image: ImageData,
          _options?: { pixelRatio?: number }
        ) => {
          keys.add(key)
        }
      )
      const map = {
        hasImage: (key: string) => keys.has(key),
        addImage,
      } as unknown as mapboxgl.Map
      ensurePublicMapBadgeImages(map)
      expect(addImage).toHaveBeenCalledTimes(7)
      expect(addImage.mock.calls.map(([, image]) => image)).toEqual([
        expect.objectContaining({ width: 136, height: 136 }),
        expect.objectContaining({ width: 160, height: 160 }),
        expect.objectContaining({ width: 192, height: 192 }),
        expect.objectContaining({ width: 152, height: 152 }),
        expect.objectContaining({ width: 176, height: 176 }),
        expect.objectContaining({ width: 208, height: 208 }),
        expect.objectContaining({ width: 160, height: 160 }),
      ])
      expect(addImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { pixelRatio: 4 }
      )
      ensurePublicMapBadgeImages(map)
      expect(addImage).toHaveBeenCalledTimes(7)
    })

    it("returns no sprite and registers no images when 2D context creation fails", () => {
      const { context } = installCanvasEnvironment(kind, true)
      expect(createDot(markerInput)).toBeNull()
      expect(createPin(markerInput)).toBeNull()
      expect(
        createPill({
          label: "Cooling",
          resourceCategory: "emergency_cooling_centers",
          selected: false,
        })
      ).toBeNull()
      expect(buildPublicMapClusterSprite({ signature })).toBeNull()
      const addImage = vi.fn()
      ensurePublicMapBadgeImages({
        hasImage: () => false,
        addImage,
      } as unknown as mapboxgl.Map)
      expect(addImage).not.toHaveBeenCalled()
      expect(context.getImageData).not.toHaveBeenCalled()
      expect(context.scale).not.toHaveBeenCalled()
    })

    it("crops and caches decoded images without changing source ownership", async () => {
      const { context } = installCanvasEnvironment(kind)
      const { original, normalized, decode } = installBitmapDecoder()
      const load = getPublicMapMarkerImageBitmap(request)
      expect(getPublicMapMarkerImageBitmap(request)).toBe(load)
      await expect(load).resolves.toMatchObject({
        status: "ready",
        bitmap: normalized,
      })
      expect(context.drawImage).toHaveBeenCalledWith(
        original,
        40,
        0,
        80,
        80,
        0,
        0,
        576,
        576
      )
      expect(decode).toHaveBeenCalledTimes(2)
      expect(original.close).toHaveBeenCalledOnce()
      expect(normalized.close).not.toHaveBeenCalled()
    })

    it("keeps the decoded image usable when normalization has no 2D context", async () => {
      const { context } = installCanvasEnvironment(kind, true)
      const { original, decode } = installBitmapDecoder()
      await expect(
        getPublicMapMarkerImageBitmap(request)
      ).resolves.toMatchObject({ status: "ready", bitmap: original })
      expect(decode).toHaveBeenCalledOnce()
      expect(original.close).not.toHaveBeenCalled()
      expect(context.drawImage).not.toHaveBeenCalled()
    })
  }
)

it("keeps the decoded bitmap when neither canvas implementation is available", async () => {
  vi.stubGlobal("OffscreenCanvas", undefined)
  vi.stubGlobal("document", undefined)
  const { original, decode } = installBitmapDecoder()
  await expect(getPublicMapMarkerImageBitmap(request)).resolves.toMatchObject({
    status: "ready",
    bitmap: original,
  })
  expect(decode).toHaveBeenCalledOnce()
  expect(original.close).not.toHaveBeenCalled()
})
