import { describe, expect, it, vi } from "vitest"
import type mapboxgl from "mapbox-gl"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { buildPublicMapPointFeatures } from "@/lib/public-map/public-map-geojson"
import { resolvePublicMapMarkerFallbackAccent } from "@/lib/public-map/public-map-marker-fallback"
import {
  createPublicMapFallbackMarkerImage,
  createPublicMapRemoteMarkerImage,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO,
  resolvePublicMapMarkerChromeGeometry,
  resolvePublicMapMarkerChromePalette,
} from "@/lib/public-map/public-map-marker-canvas"
import {
  PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT,
  PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH,
} from "@/lib/public-map/public-map-marker-canvas-constants"
import {
  ensurePublicMapMarkerImages,
  resetPublicMapMarkerImageCachesForTest,
} from "@/lib/public-map/public-map-marker-images"
import {
  resolvePublicMapSpecialPillMarkerChromeGeometry,
  resolvePublicMapSpecialPillMarkerChromePalette,
} from "@/lib/public-map/public-map-special-marker-canvas"
import { PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE } from "@/lib/public-map/public-map-marker-bitmap-cache"
import {
  buildPublicMapPointLabelExpression,
  resolvePublicMapPointIconSize,
  resolvePublicMapPointShadowOpacity,
  resolvePublicMapPointShadowSize,
  resolvePublicMapSelectedPointIconSize,
  resolvePublicMapSelectedPointShadowOpacity,
  resolvePublicMapSelectedPointShadowSize,
} from "@/lib/public-map/public-map-marker-style"
import { PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY } from "@/lib/public-map/public-map-marker-styles"
import { resolvePublicMapResourceCategoryColor } from "@/lib/public-map/resource-categories"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

function buildOrganization(
  overrides: Partial<PublicMapOrganization> = {}
): PublicMapOrganization {
  return {
    id: "org-1",
    name: "Alpha Org",
    tagline: null,
    description: null,
    boilerplate: null,
    vision: null,
    mission: null,
    values: null,
    needStatement: null,
    originStory: null,
    theoryOfChange: null,
    formationStatus: null,
    contactName: null,
    logoUrl: null,
    brandMarkUrl: null,
    headerUrl: null,
    website: null,
    donateUrl: null,
    email: null,
    phone: null,
    twitter: null,
    facebook: null,
    linkedin: null,
    instagram: null,
    brandPrimary: null,
    brandColors: [],
    brandThemePresetId: null,
    brandAccentPresetId: null,
    brandTypographyPresetId: null,
    brandTypography: null,
    brandKitAvailable: false,
    latitude: 41.8781,
    longitude: -87.6298,
    address: "233 S Wacker Dr, Chicago, IL 60606",
    addressStreet: "233 S Wacker Dr",
    addressPostal: null,
    city: "Chicago",
    state: "IL",
    country: "United States",
    locationUrl: null,
    publicSlug: "alpha-org",
    activityLinks: [],
    programPreview: null,
    programs: [],
    programCount: 0,
    groups: ["community"],
    primaryGroup: "community",
    isOnlineOnly: false,
    ...overrides,
  }
}

function installCanvasMocks() {
  const gradient = {
    addColorStop: vi.fn(),
  }
  const styles = {
    fillStyle: [] as unknown[],
    lineWidth: [] as number[],
    strokeStyle: [] as unknown[],
  }
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn(
      (_: number, __: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        height,
        width,
      })
    ),
    lineTo: vi.fn(),
    measureText: vi.fn((value: string) => ({
      width: value.length * 5,
    })),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    set fillStyle(value: unknown) {
      styles.fillStyle.push(value)
    },
    set font(_: string) {},
    set lineCap(_: string) {},
    set lineJoin(_: string) {},
    set lineWidth(value: number) {
      styles.lineWidth.push(value)
    },
    set shadowBlur(_: number) {},
    set shadowColor(_: string) {},
    set shadowOffsetY(_: number) {},
    set strokeStyle(value: string) {
      styles.strokeStyle.push(value)
    },
    set textAlign(_: string) {},
    set textBaseline(_: string) {},
  }
  const previousDocument = globalThis.document
  const previousCreateImageBitmap = globalThis.createImageBitmap
  const previousPath2D = globalThis.Path2D
  class MockPath2D {
    constructor(readonly path?: string) {}
  }

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => context),
        height: 0,
        width: 0,
      })),
    },
  })
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: vi.fn(async () => ({
      close: vi.fn(),
      height: 8,
      width: 8,
    })),
  })
  Object.defineProperty(globalThis, "Path2D", {
    configurable: true,
    value: MockPath2D,
  })

  return Object.assign(
    () => {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      })
      Object.defineProperty(globalThis, "createImageBitmap", {
        configurable: true,
        value: previousCreateImageBitmap,
      })
      Object.defineProperty(globalThis, "Path2D", {
        configurable: true,
        value: previousPath2D,
      })
    },
    { context, gradient, styles }
  )
}

function createImageMapMock({
  hasAllImages = false,
}: { hasAllImages?: boolean } = {}) {
  const imageKeys = new Set<string>()
  return {
    addImage: vi.fn((key: string) => {
      imageKeys.add(key)
    }),
    hasImage: vi.fn((key: string) => hasAllImages || imageKeys.has(key)),
    updateImage: vi.fn((key: string) => {
      imageKeys.add(key)
    }),
  } as unknown as mapboxgl.Map & {
    addImage: ReturnType<typeof vi.fn>
    hasImage: ReturnType<typeof vi.fn>
    updateImage: ReturnType<typeof vi.fn>
  }
}

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

function expectedConditionalZoomNumberExpression(
  stops: Array<
    readonly [zoom: number, specialValue: number, standardValue: number]
  >
): mapboxgl.ExpressionSpecification {
  const specialMarkerPredicate = [
    "==",
    ["get", "markerStyleKey"],
    PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
  ]

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...stops.flatMap(([zoom, specialValue, standardValue]) => [
      zoom,
      ["case", specialMarkerPredicate, specialValue, standardValue],
    ]),
  ] as mapboxgl.ExpressionSpecification
}

describe("public map marker fallbacks", () => {
  it("keeps special-marker titles inside the sprite instead of a separate label layer", () => {
    expect(buildPublicMapPointLabelExpression()).toEqual([
      "case",
      [
        "==",
        ["get", "markerStyleKey"],
        PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
      ],
      "",
      ["coalesce", ["get", "name"], ""],
    ])
  })

  it("uses readable category-dot marker scale and restrained shadow ramps", () => {
    expect(PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE).toBe(288)
    expect(PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO).toBe(8)
    expect(
      PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE / PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO
    ).toBe(36)
    expect(resolvePublicMapPointIconSize()).toEqual(
      expectedConditionalZoomNumberExpression([
        [3, 1.18, 1.56],
        [8, 1.26, 1.72],
        [11, 1.38, 1.94],
        [14, 1.5, 2.12],
        [16, 1.56, 2.24],
      ])
    )
    expect(resolvePublicMapSelectedPointIconSize()).toEqual(
      expectedConditionalZoomNumberExpression([
        [3, 1.26, 1.84],
        [8, 1.36, 2.02],
        [11, 1.5, 2.22],
        [14, 1.64, 2.38],
        [16, 1.7, 2.5],
      ])
    )
    expect(resolvePublicMapPointShadowOpacity()).toEqual(
      expectedConditionalZoomNumberExpression([
        [4, 0, 0.08],
        [8, 0, 0.14],
        [11, 0, 0.22],
        [14, 0, 0.32],
        [16, 0, 0.38],
      ])
    )
    expect(resolvePublicMapPointShadowSize()).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      1.42,
      8,
      1.58,
      11,
      1.78,
      14,
      1.96,
      16,
      2.08,
    ])
    expect(resolvePublicMapSelectedPointShadowSize()).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      1.72,
      8,
      1.9,
      11,
      2.1,
      14,
      2.28,
      16,
      2.4,
    ])
    expect(resolvePublicMapSelectedPointShadowOpacity()).toEqual(
      expectedConditionalZoomNumberExpression([
        [3, 0, 0.18],
        [8, 0, 0.26],
        [11, 0, 0.34],
        [16, 0, 0.42],
      ])
    )
  })

  it("uses vibrant non-gray marker accents for orange and organization categories", () => {
    expect(resolvePublicMapMarkerFallbackAccent("housing")).toBe("#f97316")
    expect(resolvePublicMapMarkerFallbackAccent("workforce")).toBe("#fb923c")
    expect(resolvePublicMapResourceCategoryColor("education")).toBe("#f59e0b")
    expect(resolvePublicMapResourceCategoryColor("employment")).toBe("#f97316")
    expect(resolvePublicMapResourceCategoryColor("organizations")).toBe(
      "#0ea5e9"
    )
  })

  it("registers fallback dots first and then upgrades verified org markers with profile images", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)
    const map = createImageMapMock()
    const onImagesChanged = vi.fn()
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "housing-help",
        logoUrl: "https://cdn.example.com/housing.png",
        primaryGroup: "housing",
      }),
    ])
    const markerImageKey = features[0]!.properties.markerImageKey

    const loads = ensurePublicMapMarkerImages({
      map,
      features,
      onImagesChanged,
    })

    expect(loads).toHaveLength(1)
    expect(map.addImage).toHaveBeenCalledWith(
      markerImageKey,
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      }),
      { pixelRatio: PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO }
    )
    expect(map.addImage).toHaveBeenCalledWith(
      `${markerImageKey}-selected`,
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      }),
      { pixelRatio: PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO }
    )
    expect(restoreCanvasMocks.context.strokeRect).not.toHaveBeenCalled()
    await expect(Promise.all(loads)).resolves.toEqual([
      {
        key: markerImageKey,
        status: "ready",
        changed: true,
      },
    ])
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://cdn.example.com/housing.png",
      {
        cache: "force-cache",
        mode: "cors",
      }
    )
    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(
      expect.objectContaining({
        height: PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE,
        width: PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE,
      })
    )
    expect(restoreCanvasMocks.context.drawImage).toHaveBeenCalled()
    expect(map.updateImage).toHaveBeenCalledWith(
      markerImageKey,
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      })
    )
    expect(map.updateImage).toHaveBeenCalledWith(
      `${markerImageKey}-selected`,
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      })
    )
    expect(onImagesChanged).toHaveBeenCalledTimes(2)

    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("keeps archived external marker rendering stable", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const map = createImageMapMock()
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "external-food",
        logoUrl: "https://cdn.example.com/external.png",
        primaryGroup: "community",
      }),
    ]).map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        itemType: "external_resource" as const,
        markerImageUrl: "https://cdn.example.com/external.png",
        primaryResourceCategory: "food" as const,
        verificationStatus: "external_data" as const,
      },
    }))

    const loads = ensurePublicMapMarkerImages({ map, features })

    expect(loads).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.context.drawImage).not.toHaveBeenCalled()
    expect(map.updateImage).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.styles.fillStyle).toEqual(
      expect.arrayContaining([restoreCanvasMocks.gradient, "#FFFFFF"])
    )
    expect(restoreCanvasMocks.context.createRadialGradient).toHaveBeenCalled()
    expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalledWith(
      "F",
      36,
      expect.any(Number),
      expect.any(Number)
    )
    expect(restoreCanvasMocks.context.stroke).toHaveBeenCalledWith(
      expect.any(Object)
    )
    expect(restoreCanvasMocks.styles.strokeStyle).toContain("#FFFFFF")

    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("does not redraw or refetch marker images already registered in Mapbox", () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const map = createImageMapMock({ hasAllImages: true })
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "ready-marker",
        logoUrl: "https://cdn.example.com/ready.png",
        primaryGroup: "education",
      }),
    ])

    const loads = ensurePublicMapMarkerImages({ map, features })

    expect(loads).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(map.addImage).not.toHaveBeenCalled()
    expect(map.updateImage).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.context.getImageData).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("treats Mapbox-registered marker pairs as ready after local status cache loss", () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const map = createImageMapMock()
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "cached-marker",
        logoUrl: null,
        primaryGroup: "climate",
      }),
    ])

    expect(ensurePublicMapMarkerImages({ map, features })).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()

    resetPublicMapMarkerImageCachesForTest()
    fetchSpy.mockClear()
    restoreCanvasMocks.context.getImageData.mockClear()
    map.addImage.mockClear()
    map.updateImage.mockClear()

    const loads = ensurePublicMapMarkerImages({ map, features })

    expect(loads).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(map.addImage).not.toHaveBeenCalled()
    expect(map.updateImage).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.context.getImageData).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("renders decoded profile images inside the stable marker chrome", () => {
    const restoreCanvasMocks = installCanvasMocks()
    const bitmap = {
      close: vi.fn(),
      height: 48,
      width: 48,
    } as unknown as ImageBitmap

    const image = createPublicMapRemoteMarkerImage({
      bitmap,
      primaryGroup: "housing",
      selected: false,
    })
    const selectedImage = createPublicMapRemoteMarkerImage({
      bitmap,
      primaryGroup: "housing",
      selected: true,
      verificationStatus: "verified_platform",
    })
    const fallbackImage = createPublicMapFallbackMarkerImage({
      label: "Housing Help",
      primaryGroup: "housing",
      sameLocationCount: 3,
      selected: false,
      verificationStatus: "external_data",
    })
    const canvasSource = readRepoFile(
      "src/lib/public-map/public-map-marker-canvas.ts"
    )
    const canvasConstantsSource = readRepoFile(
      "src/lib/public-map/public-map-marker-canvas-constants.ts"
    )
    const imageLoaderSource = readRepoFile(
      "src/lib/public-map/public-map-marker-images.ts"
    )
    const normalImageGeometry = resolvePublicMapMarkerChromeGeometry(
      false,
      "image"
    )
    const selectedImageGeometry = resolvePublicMapMarkerChromeGeometry(
      true,
      "image"
    )
    const selectedDotGeometry = resolvePublicMapMarkerChromeGeometry(true)
    const selectedDrawCall = restoreCanvasMocks.context.drawImage.mock.calls[1]

    expect(image).toEqual(
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      })
    )
    expect(selectedImage).toEqual(
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      })
    )
    expect(fallbackImage).toEqual(
      expect.objectContaining({
        width: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
        height: PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
      })
    )
    expect(restoreCanvasMocks.context.fillText).toHaveBeenCalledWith(
      "3",
      expect.any(Number),
      expect.any(Number)
    )
    expect(restoreCanvasMocks.context.drawImage).toHaveBeenCalledWith(
      bitmap,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    )
    expect(normalImageGeometry.contentRadius).toBe(13.8)
    expect(selectedImageGeometry).toEqual({
      centerX: 36,
      centerY: 36,
      contentRadius: 22.6,
      outerRadius: 27.2,
    })
    expect(restoreCanvasMocks.context.arc).not.toHaveBeenCalledWith(
      36,
      36,
      selectedImageGeometry.outerRadius + 2.8,
      0,
      Math.PI * 2
    )
    expect(selectedImageGeometry.contentRadius).toBeGreaterThan(
      selectedDotGeometry.contentRadius + 3.5
    )
    expect(Number(selectedDrawCall?.[7])).toBeCloseTo(
      selectedImageGeometry.contentRadius * 2,
      5
    )
    expect(Number(selectedDrawCall?.[8])).toBeCloseTo(
      selectedImageGeometry.contentRadius * 2,
      5
    )
    expect(restoreCanvasMocks.styles.fillStyle).toEqual(
      expect.arrayContaining([restoreCanvasMocks.gradient, "#FFFFFF"])
    )
    expect(canvasSource).toContain("drawSameLocationBadge")
    expect(canvasSource).toContain("drawBitmapCover")
    expect(canvasSource).toContain("imageSmoothingQuality")
    expect(canvasSource).toContain('contentKind === "image"')
    expect(canvasSource).not.toContain('contentKind !== "image"')
    expect(canvasConstantsSource).toContain(
      "PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO = 8"
    )
    expect(canvasSource).toContain("primaryGroup?: PublicMapGroupKey | null")
    expect(imageLoaderSource).toContain("createRemoteMarkerImageLoad")
    expect(imageLoaderSource).toContain('itemType !== "platform_organization"')
    expect(imageLoaderSource).toContain("shouldSuppressSelectedFallbackCheck")
    expect(imageLoaderSource).toContain("getPublicMapMarkerImageBitmap")
    expect(imageLoaderSource).toContain(
      'import { PUBLIC_MAP_POINT_SHADOW_KEY } from "./public-map-marker-style"'
    )
    expect(imageLoaderSource).toContain(
      "event.id === PUBLIC_MAP_POINT_SHADOW_KEY"
    )

    restoreCanvasMocks()
  })

  it("suppresses the old selected checkmark fallback for image-backed org markers", () => {
    const restoreCanvasMocks = installCanvasMocks()

    createPublicMapFallbackMarkerImage({
      label: "Housing Help",
      primaryGroup: "housing",
      selected: true,
      suppressSelectedCheck: true,
      verificationStatus: "verified_platform",
    })

    expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalled()

    restoreCanvasMocks()
  })

  it("keeps individual dot marker chrome centered with one clean outer ring", () => {
    const restoreCanvasMocks = installCanvasMocks()
    const normalGeometry = resolvePublicMapMarkerChromeGeometry(false)
    const selectedGeometry = resolvePublicMapMarkerChromeGeometry(true)
    const selectedImageGeometry = resolvePublicMapMarkerChromeGeometry(
      true,
      "image"
    )

    createPublicMapFallbackMarkerImage({
      label: "Food Access",
      markerAccentColor: "#e11d48",
      selected: false,
      verificationStatus: "external_data",
    })

    expect(normalGeometry).toEqual({
      centerX: 36,
      centerY: 36,
      contentRadius: 13.8,
      outerRadius: 17.2,
    })
    expect(selectedGeometry).toEqual({
      centerX: 36,
      centerY: 36,
      contentRadius: 17.2,
      outerRadius: 21.8,
    })
    expect(selectedImageGeometry.outerRadius).toBeGreaterThan(
      selectedGeometry.outerRadius + 5
    )
    expect(
      normalGeometry.outerRadius - normalGeometry.contentRadius
    ).toBeCloseTo(3.4, 5)
    expect(
      selectedGeometry.outerRadius - selectedGeometry.contentRadius
    ).toBeCloseTo(4.6, 5)
    expect(restoreCanvasMocks.context.createRadialGradient).toHaveBeenCalled()
    expect(restoreCanvasMocks.gradient.addColorStop).not.toHaveBeenCalledWith(
      0,
      expect.stringContaining("255, 255, 255")
    )
    expect(restoreCanvasMocks.styles.fillStyle).toEqual(
      expect.arrayContaining([restoreCanvasMocks.gradient, "#FFFFFF"])
    )
    expect(restoreCanvasMocks.styles.lineWidth).toEqual(
      expect.arrayContaining([1.12])
    )
    expect(restoreCanvasMocks.styles.lineWidth).not.toContain(0.82)
    expect(restoreCanvasMocks.context.ellipse).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.styles.lineWidth).not.toContain(2)
    expect(restoreCanvasMocks.styles.lineWidth).not.toContain(2.25)
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      36,
      36,
      normalGeometry.outerRadius + 2.4,
      0,
      Math.PI * 2
    )
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      36,
      36,
      normalGeometry.outerRadius,
      0,
      Math.PI * 2
    )
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      36,
      36,
      normalGeometry.contentRadius,
      0,
      Math.PI * 2
    )
    expect(restoreCanvasMocks.context.arc).not.toHaveBeenCalledWith(
      35,
      35,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    )

    restoreCanvasMocks()
  })

  it("draws the food shopping-cart icon on seeded resource dot markers", () => {
    const restoreCanvasMocks = installCanvasMocks()
    const iconSource = readRepoFile(
      "src/lib/public-map/public-map-marker-icons.ts"
    )

    createPublicMapFallbackMarkerImage({
      label: "Food Access",
      markerAccentColor: resolvePublicMapResourceCategoryColor("food"),
      resourceCategory: "food",
      selected: false,
      verificationStatus: "external_data",
    })

    expect(restoreCanvasMocks.styles.fillStyle).toContain(
      restoreCanvasMocks.gradient
    )
    expect(restoreCanvasMocks.styles.strokeStyle).toContain("#FFFFFF")
    expect(restoreCanvasMocks.context.createRadialGradient).toHaveBeenCalled()
    expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalled()
    expect(restoreCanvasMocks.context.stroke).toHaveBeenCalledWith(
      expect.any(Object)
    )
    expect(iconSource).toContain("resource-category-icon-paths")
    expect(iconSource).toContain(
      "resolvePublicMapResourceCategoryIconDefinition"
    )
    expect(iconSource).not.toContain("CATEGORY_BADGE_OVERRIDES")
    expect(iconSource).not.toContain(
      "resolvePublicMapResourceCategoryBadgeText"
    )
    expect(iconSource).toContain("Path2D")
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      36,
      36,
      resolvePublicMapMarkerChromeGeometry(false).contentRadius,
      0,
      Math.PI * 2
    )

    restoreCanvasMocks()
  })

  it("draws special resource markers as compact capsules with circular icon badges", () => {
    const restoreCanvasMocks = installCanvasMocks()
    const geometry = resolvePublicMapSpecialPillMarkerChromeGeometry(false, 70)
    const selectedGeometry = resolvePublicMapSpecialPillMarkerChromeGeometry(
      true,
      70
    )

    createPublicMapFallbackMarkerImage({
      label: "Garfield Center",
      markerAccentColor: "#0284c7",
      markerStyleKey: PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
      resourceCategory: "emergency_cooling_centers",
      selected: false,
      theme: "dark",
      verificationStatus: "external_data",
    })

    expect(geometry).toEqual({
      canvasHeight: 76,
      canvasWidth: 204,
      contentRadius: 11.1,
      iconBadgeRadius: 15.5,
      iconCenterX: 59.75,
      iconCenterY: 38,
      labelMaxWidth: 70,
      labelX: 85.75,
      labelY: 38.3,
      outerHeight: 42,
      outerRadius: 21,
      outerWidth: 131.5,
      outerX: 36.25,
      outerY: 17,
      surfaceStrokeWidth: 0.62,
    })
    expect(selectedGeometry).toMatchObject({
      canvasHeight: 76,
      canvasWidth: 204,
      contentRadius: 11.8,
      iconBadgeRadius: 17,
      iconCenterX: 59.5,
      iconCenterY: 38,
      labelMaxWidth: 70,
      labelX: 87.5,
      labelY: 38.3,
      outerHeight: 46,
      outerRadius: 23,
      outerWidth: 137,
      outerX: 33.5,
      outerY: 15,
      surfaceStrokeWidth: 0.76,
    })
    expect(geometry.outerRadius).toBe(geometry.outerHeight / 2)
    expect(selectedGeometry.outerRadius).toBe(selectedGeometry.outerHeight / 2)
    expect(geometry.outerWidth / geometry.outerHeight).toBeGreaterThan(3)
    expect(
      selectedGeometry.outerWidth / selectedGeometry.outerHeight
    ).toBeGreaterThan(2.9)
    expect(
      geometry.iconCenterX - geometry.iconBadgeRadius - geometry.outerX
    ).toBe(8)
    expect(
      geometry.outerX +
        geometry.outerWidth -
        (geometry.labelX + geometry.labelMaxWidth)
    ).toBe(12)
    expect(
      selectedGeometry.iconCenterX -
        selectedGeometry.iconBadgeRadius -
        selectedGeometry.outerX
    ).toBe(9)
    expect(
      selectedGeometry.outerX +
        selectedGeometry.outerWidth -
        (selectedGeometry.labelX + selectedGeometry.labelMaxWidth)
    ).toBe(13)
    expect(
      resolvePublicMapSpecialPillMarkerChromePalette("dark", false, "#0284c7")
    ).toEqual({
      iconBadgeFill: "#FFFFFF",
      iconBadgeShadowColor: "rgba(0, 0, 0, 0.22)",
      iconColor: "#38BDF8",
      iconGlowColor: "rgba(56, 189, 248, 0.28)",
      shadowColor: "rgba(0, 0, 0, 0.34)",
      surfaceBackdropFill: "rgba(24, 24, 27, 0.42)",
      surfaceFill: "rgba(255, 255, 255, 0.1)",
      surfaceStroke: "rgba(255, 255, 255, 0.15)",
      textColor: "#FAFAFA",
    })
    expect(
      resolvePublicMapSpecialPillMarkerChromePalette("light", false, "#0284c7")
    ).toEqual(
      resolvePublicMapSpecialPillMarkerChromePalette("dark", false, "#0284c7")
    )
    expect(
      resolvePublicMapSpecialPillMarkerChromePalette("dark", true, "#0284c7")
    ).toMatchObject({
      iconBadgeFill: "#FFFFFF",
      iconBadgeShadowColor: "rgba(0, 0, 0, 0.28)",
      iconColor: "#38BDF8",
      surfaceBackdropFill: "rgba(24, 24, 27, 0.48)",
      surfaceFill: "rgba(255, 255, 255, 0.15)",
    })
    expect(
      resolvePublicMapSpecialPillMarkerChromePalette("light", true, "#0284c7")
    ).toEqual(
      resolvePublicMapSpecialPillMarkerChromePalette("dark", true, "#0284c7")
    )
    expect(restoreCanvasMocks.context.getImageData).toHaveBeenCalledWith(
      0,
      0,
      PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH,
      PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT
    )
    expect(restoreCanvasMocks.context.fillText).toHaveBeenCalledWith(
      "Cooling Center",
      geometry.labelX,
      geometry.labelY
    )
    expect(restoreCanvasMocks.styles.fillStyle).toEqual(
      expect.arrayContaining([
        "rgba(24, 24, 27, 0.42)",
        "rgba(255, 255, 255, 0.1)",
        "#FFFFFF",
        "#FAFAFA",
      ])
    )
    expect(restoreCanvasMocks.styles.strokeStyle).toEqual(
      expect.arrayContaining(["rgba(255, 255, 255, 0.15)", "#38BDF8"])
    )
    expect(restoreCanvasMocks.styles.strokeStyle).not.toContain(
      "rgba(56, 189, 248, 0.42)"
    )
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      geometry.iconCenterX,
      geometry.iconCenterY,
      geometry.iconBadgeRadius,
      0,
      Math.PI * 2
    )
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      geometry.outerX + geometry.outerWidth - geometry.outerRadius,
      geometry.iconCenterY,
      geometry.outerRadius,
      -Math.PI / 2,
      Math.PI / 2
    )
    expect(restoreCanvasMocks.context.arc).toHaveBeenCalledWith(
      geometry.outerX + geometry.outerRadius,
      geometry.iconCenterY,
      geometry.outerRadius,
      Math.PI / 2,
      (Math.PI * 3) / 2
    )
    expect(restoreCanvasMocks.context.stroke).toHaveBeenCalledWith(
      expect.any(Object)
    )
    expect(restoreCanvasMocks.context.arc).not.toHaveBeenCalledWith(
      36,
      36,
      resolvePublicMapMarkerChromeGeometry(false).outerRadius,
      0,
      Math.PI * 2
    )

    restoreCanvasMocks()
  })

  it("uses a dark marker shell palette for dark map mode", () => {
    expect(resolvePublicMapMarkerChromePalette("dark")).toMatchObject({
      badgeFill: "rgba(20, 25, 24, 0.96)",
      badgeStroke: "rgba(212, 212, 216, 0.28)",
      haloStroke: "rgba(212, 212, 216, 0.48)",
      surfaceFill: "rgba(39, 39, 42, 0.52)",
      surfaceStroke: "rgba(255, 255, 255, 0.15)",
    })
    expect(resolvePublicMapMarkerChromePalette("light")).toMatchObject({
      badgeFill: "rgba(20, 25, 24, 0.96)",
      badgeStroke: "rgba(37, 99, 235, 0.42)",
      haloStroke: "rgba(37, 99, 235, 0.5)",
      surfaceFill: "rgba(37, 99, 235, 0.16)",
      surfaceStroke: "rgba(255, 255, 255, 0.46)",
    })
    expect(
      resolvePublicMapMarkerChromePalette("dark", "#e11d48")
    ).toMatchObject({
      haloStroke: "rgba(225, 29, 72, 0.72)",
      shadowColor: "rgba(225, 29, 72, 0.62)",
      surfaceFill: "rgba(225, 29, 72, 0.24)",
    })
    expect(
      resolvePublicMapMarkerChromePalette("light", "#e11d48")
    ).toMatchObject({
      haloStroke: "rgba(225, 29, 72, 0.72)",
      shadowColor: "rgba(225, 29, 72, 0.5)",
      surfaceFill: "rgba(225, 29, 72, 0.28)",
    })
  })

  it("registers pin marker images before swapping unclustered source data", () => {
    const markerSource = readRepoFile(
      "src/components/public/public-map-index/sync-public-map-marker-artwork.ts"
    )

    expect(
      markerSource.indexOf("ensurePublicMapPinMarkerImages({")
    ).toBeLessThan(
      markerSource.indexOf("const updated = setPublicMapMarkerSourceData")
    )
    expect(markerSource).not.toContain("markerImageLoads")
    expect(markerSource).not.toContain("createRemoteMarkerImageLoad")
  })
})
