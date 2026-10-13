import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"
import type mapboxgl from "mapbox-gl"

import {
  buildPublicMapDataVersion,
  buildPublicMapPointFeatures,
  parsePublicMapOrganizationIds,
  resolvePublicMapMarkerImageKey,
} from "@/lib/public-map/public-map-geojson"
import {
  createPublicMapClusterClient,
  shouldUsePublicMapClusterResult,
} from "@/lib/public-map/public-map-cluster-client"
import {
  createPublicMapClusterViewportQueryState,
  preparePublicMapClusterViewportQuery,
  resolvePublicMapClusterBbox,
  resolvePublicMapClusterZoom,
} from "@/lib/public-map/public-map-bounds"
import {
  buildPublicMapClusterImageId,
  buildPublicMapClusterSignature,
  buildPublicMapClusterSprite,
  createPublicMapClusterSpriteCache,
  enrichPublicMapClusterSourceDataWithSprites,
  getPublicMapClusterTier,
  PUBLIC_MAP_CLUSTER_TIERS,
  resolvePublicMapClusterZoomBucket,
  upgradePublicMapClusterSpritesWithAvatars,
} from "@/lib/public-map/public-map-cluster-sprites"
import {
  mapPublicMapClusterProperties,
  resolvePublicMapClusterVisibleCategoryKeys,
} from "@/lib/public-map/public-map-cluster-aggregation"
import {
  PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
  resolvePublicMapClusterChromePalette,
} from "@/lib/public-map/public-map-cluster-sprite-renderer"
import {
  computePublicMapClusterCircleLayout,
  getPublicMapClusterNormalizedCircleLayout,
  getPublicMapClusterShellMetrics,
  PUBLIC_MAP_CLUSTER_LAYOUT_BASE_SIZE,
  PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION,
  resolveVisiblePublicMapClusterDotCount,
} from "@/lib/public-map/public-map-cluster-layout"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import {
  MAPBOX_LOAD_ERROR_MESSAGE,
  MAPBOX_RUNTIME_ERROR_MESSAGE,
  isRecoverablePublicMapTileError,
  resolvePublicMapRuntimeErrorMessage,
} from "@/components/public/public-map-index/public-map-runtime-errors"
import {
  ensurePublicMapMarkerImages,
  getPublicMapMarkerImageBitmap,
  resetPublicMapMarkerImageCachesForTest,
} from "@/lib/public-map/public-map-marker-images"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

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

function installPublicMapImageCanvasMocks() {
  const gradient = {
    addColorStop: vi.fn(),
  }
  const styles = {
    fillStyle: [] as unknown[],
    strokeStyle: [] as string[],
  }
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    clearRect: vi.fn(),
    clip: vi.fn(),
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
    set lineWidth(_: number) {},
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

  const restore = () => {
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
  }
  return Object.assign(restore, { context, gradient, styles })
}

function createImageMapMock() {
  const imageKeys = new Set<string>()
  return {
    addImage: vi.fn((key: string) => {
      imageKeys.add(key)
    }),
    hasImage: vi.fn((key: string) => imageKeys.has(key)),
    updateImage: vi.fn(),
  } as unknown as mapboxgl.Map & {
    addImage: ReturnType<typeof vi.fn>
    hasImage: ReturnType<typeof vi.fn>
    updateImage: ReturnType<typeof vi.fn>
  }
}

function readClusterDotArcs(
  context: ReturnType<typeof installPublicMapImageCanvasMocks>["context"]
) {
  return context.arc.mock.calls
    .filter((call) => Number(call[2]) < 24)
    .map((call) => ({
      radius: Number(call[2]),
      x: Number(call[0]),
      y: Number(call[1]),
    }))
}

function expectClusterDotsToFit({
  dots,
  size,
}: {
  dots: Array<{ radius: number; x: number; y: number }>
  size: number
}) {
  const metrics = getPublicMapClusterShellMetrics(size)
  const paintedRadiusForDot = (dot: { radius: number }) => dot.radius
  const left = Math.min(...dots.map((dot) => dot.x - paintedRadiusForDot(dot)))
  const right = Math.max(...dots.map((dot) => dot.x + paintedRadiusForDot(dot)))
  const top = Math.min(...dots.map((dot) => dot.y - paintedRadiusForDot(dot)))
  const bottom = Math.max(
    ...dots.map((dot) => dot.y + paintedRadiusForDot(dot))
  )
  const shellDiameter = metrics.paintedShellRadius * 2
  const horizontalFillRatio = (right - left) / shellDiameter
  const verticalFillRatio = (bottom - top) / shellDiameter
  const centroid = getAreaWeightedClusterCentroid(dots)

  for (const dot of dots) {
    expect(
      Math.hypot(dot.x - metrics.center, dot.y - metrics.center) +
        paintedRadiusForDot(dot)
    ).toBeLessThanOrEqual(
      metrics.paintedShellRadius - metrics.avatarEdgeGap + 0.02
    )
  }

  expect(
    Math.hypot(centroid.x - metrics.center, centroid.y - metrics.center)
  ).toBeLessThanOrEqual(size * 0.045)

  if (dots.length === 1) {
    expect(dots[0]!.x).toBeCloseTo(metrics.center, 5)
    expect(dots[0]!.y).toBeCloseTo(metrics.center, 5)
    expect(dots[0]!.radius).toBeGreaterThanOrEqual(size * 0.26)
    expect(horizontalFillRatio).toBeGreaterThanOrEqual(0.62)
    expect(verticalFillRatio).toBeGreaterThanOrEqual(0.62)
  }

  if (dots.length >= 2) {
    const radii = dots.map((dot) => dot.radius)
    const largestDot = dots.reduce((largest, dot) =>
      dot.radius > largest.radius ? dot : largest
    )
    const sortedRadii = [...radii].sort((first, second) => second - first)
    const paintedGaps = dots.flatMap((dot, index) =>
      dots.slice(index + 1).map((otherDot) => {
        const distance = Math.hypot(dot.x - otherDot.x, dot.y - otherDot.y)
        return (
          (distance -
            paintedRadiusForDot(dot) -
            paintedRadiusForDot(otherDot)) /
          size
        )
      })
    )
    const nearestPaintedGaps = dots.map((dot, index) => {
      const otherGaps = dots
        .filter((_, nextIndex) => nextIndex !== index)
        .map((otherDot) => {
          const distance = Math.hypot(dot.x - otherDot.x, dot.y - otherDot.y)
          return (
            (distance -
              paintedRadiusForDot(dot) -
              paintedRadiusForDot(otherDot)) /
            size
          )
        })
      return Math.min(...otherGaps)
    })
    const mainPaintedGap =
      (Math.hypot(dots[0]!.x - dots[1]!.x, dots[0]!.y - dots[1]!.y) -
        paintedRadiusForDot(dots[0]!) -
        paintedRadiusForDot(dots[1]!)) /
      size

    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThanOrEqual(
      size * 0.03
    )
    expect(Math.min(...paintedGaps)).toBeGreaterThanOrEqual(
      metrics.avatarGap / size - 0.002
    )
    expect(Math.max(...nearestPaintedGaps)).toBeLessThanOrEqual(0.065)
    expect(mainPaintedGap).toBeGreaterThanOrEqual(
      metrics.avatarGap / size - 0.002
    )
    expect(mainPaintedGap).toBeLessThanOrEqual(0.08)
    expect(sortedRadii[0]).toBeGreaterThanOrEqual(size * 0.18)
    expect(sortedRadii[0]).toBeLessThanOrEqual(size * 0.34)
    expect(sortedRadii[1]).toBeGreaterThanOrEqual(size * 0.14)
    expect(sortedRadii[1]).toBeLessThanOrEqual(size * 0.24)
    expect(largestDot.x).toBeLessThanOrEqual(metrics.center - size * 0.02)
    expect(largestDot.y).toBeLessThanOrEqual(metrics.center - size * 0.02)
    expect(dots[1]!.x).toBeGreaterThan(metrics.center)
    expect(dots[1]!.y).toBeGreaterThan(metrics.center)
  }

  if (dots.length === 2) {
    const sortedRadii = [...dots]
      .map((dot) => dot.radius)
      .sort((first, second) => second - first)

    expect(sortedRadii[0]).toBeGreaterThanOrEqual(size * 0.2)
    expect(sortedRadii[1]).toBeGreaterThanOrEqual(size * 0.16)
    expect(sortedRadii[0] - sortedRadii[1]).toBeGreaterThanOrEqual(size * 0.025)
    expect(horizontalFillRatio).toBeGreaterThanOrEqual(0.76)
    expect(verticalFillRatio).toBeGreaterThanOrEqual(0.74)
  }

  if (dots.length === 3) {
    const sortedRadii = [...dots]
      .map((dot) => dot.radius)
      .sort((first, second) => second - first)

    expect(sortedRadii[0]).toBeGreaterThanOrEqual(size * 0.2)
    expect(sortedRadii[1]).toBeGreaterThanOrEqual(size * 0.16)
    expect(sortedRadii[2]).toBeGreaterThanOrEqual(size * 0.11)
    expect(sortedRadii[0] - sortedRadii[2]).toBeGreaterThanOrEqual(size * 0.06)
    expect(horizontalFillRatio).toBeGreaterThanOrEqual(0.78)
    expect(verticalFillRatio).toBeGreaterThanOrEqual(0.69)
  }

  if (dots.length === 4) {
    const sortedRadii = [...dots]
      .map((dot) => dot.radius)
      .sort((first, second) => second - first)

    expect(sortedRadii[0]).toBeGreaterThanOrEqual(size * 0.2)
    expect(sortedRadii[1]).toBeGreaterThanOrEqual(size * 0.16)
    expect(sortedRadii[2]).toBeGreaterThanOrEqual(size * 0.11)
    expect(sortedRadii[3]).toBeGreaterThanOrEqual(size * 0.08)
    expect(sortedRadii[0] - sortedRadii[3]).toBeGreaterThanOrEqual(size * 0.08)
    expect(horizontalFillRatio).toBeGreaterThanOrEqual(0.72)
    expect(verticalFillRatio).toBeGreaterThanOrEqual(0.69)
  }

  if (dots.length >= 5) {
    const sortedRadii = [...dots]
      .map((dot) => dot.radius)
      .sort((first, second) => second - first)
    const largestRadius = sortedRadii[0]!
    const smallestRadius = sortedRadii[sortedRadii.length - 1]!

    expect(horizontalFillRatio).toBeGreaterThanOrEqual(0.72)
    expect(verticalFillRatio).toBeGreaterThanOrEqual(0.78)
    expect(largestRadius).toBeGreaterThanOrEqual(size * 0.18)
    expect(largestRadius).toBeLessThanOrEqual(size * 0.24)
    expect(smallestRadius).toBeGreaterThanOrEqual(size * 0.055)
    expect(smallestRadius).toBeLessThanOrEqual(size * 0.12)
    expect(largestRadius - smallestRadius).toBeGreaterThanOrEqual(size * 0.1)
    expect(
      dots.some((dot) => dot.x > metrics.center && dot.y > metrics.center)
    ).toBe(true)
    expect(
      dots.some((dot) => dot.x > metrics.center && dot.y < metrics.center)
    ).toBe(true)
    expect(
      dots.some((dot) => dot.x < metrics.center && dot.y > metrics.center)
    ).toBe(true)
  }
}

function getAreaWeightedClusterCentroid(
  dots: Array<{ radius: number; x: number; y: number }>
) {
  let areaSum = 0
  let weightedX = 0
  let weightedY = 0

  for (const dot of dots) {
    const area = dot.radius * dot.radius
    areaSum += area
    weightedX += dot.x * area
    weightedY += dot.y * area
  }

  return {
    x: weightedX / areaSum,
    y: weightedY / areaSum,
  }
}

function normalizeClusterLayoutForSize(
  dots: Array<{ radius: number; x: number; y: number }>,
  size: number
) {
  return dots.map((dot) => ({
    radius: Number((dot.radius / size).toFixed(6)),
    x: Number((dot.x / size).toFixed(6)),
    y: Number((dot.y / size).toFixed(6)),
  }))
}

describe("public map WebGL data", () => {
  it("resolves deterministic Apple-style cluster tiers", () => {
    expect(PUBLIC_MAP_CLUSTER_TIERS).toEqual({
      small: { size: 64, avatars: 1 },
      medium: { size: 64, avatars: 2 },
      large: { size: 64, avatars: 3 },
      xlarge: { size: 64, avatars: 4 },
    })
    expect(getPublicMapClusterTier(2)).toBe("small")
    expect(getPublicMapClusterTier(5)).toBe("medium")
    expect(getPublicMapClusterTier(20)).toBe("large")
    expect(getPublicMapClusterTier(100)).toBe("xlarge")
  })

  it("builds stable cluster sprite signatures from tier and count", () => {
    const signature = buildPublicMapClusterSignature({
      totalCount: 24.9,
      imageKeys: ["org-c", "org-a", "org-b", "org-d"],
      zoom: 11.8,
    })
    const reordered = buildPublicMapClusterSignature({
      totalCount: 24,
      imageKeys: ["org-d", "org-b", "org-a", "org-c"],
      zoom: 11.1,
    })

    expect(signature.tierName).toBe("large")
    expect(signature.tier).toEqual({ size: 64, avatars: 3 })
    expect(signature.totalCount).toBe(24)
    expect(signature.visibleImageKeys).toEqual([])
    expect(signature.visibleCategoryColors).toEqual([])
    expect(signature.visibleCategoryKeys).toEqual([])
    expect(signature.overflowCount).toBe(0)
    expect(signature.zoomBucket).toBe(11)
    expect(signature.signature).toBe(
      `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:light|tier:large|count:24`
    )
    expect(signature.imageId).toBe(
      buildPublicMapClusterImageId(signature.signature)
    )
    expect(reordered).toEqual(signature)
  })

  it("builds category-aware cluster sprite signatures from weighted resource categories", () => {
    const signature = buildPublicMapClusterSignature({
      categoryKeys: ["food", "health", "food"],
      totalCount: 12,
      imageKeys: [],
      zoom: 8,
    })
    const sameMix = buildPublicMapClusterSignature({
      categoryKeys: ["food", "health", "food"],
      totalCount: 12,
      imageKeys: ["ignored-image-key"],
      zoom: 8.9,
    })
    const differentMix = buildPublicMapClusterSignature({
      categoryKeys: ["health", "food", "food"],
      totalCount: 12,
      imageKeys: [],
      zoom: 8,
    })

    expect(signature.visibleCategoryKeys).toEqual(["food", "health", "food"])
    expect(signature.visibleCategoryColors).toEqual([
      "#2563eb",
      "#059669",
      "#2563eb",
    ])
    expect(signature.signature).toBe(
      `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:light|tier:medium|count:12|categories:food,health,food`
    )
    expect(sameMix).toEqual(signature)
    expect(differentMix.signature).toBe(
      `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:light|tier:medium|count:12|categories:health,food,food`
    )
    expect(differentMix.imageId).not.toBe(signature.imageId)

    expect(
      buildPublicMapClusterSignature({
        categoryKeys: ["food", "health", "food"],
        markerTheme: "dark",
        totalCount: 12,
        imageKeys: [],
        zoom: 8,
      }).signature
    ).toBe(
      `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:dark|tier:medium|count:12|categories:food,health,food`
    )
  })

  it("falls back to a canonical cluster category when point data is missing one", () => {
    expect(
      mapPublicMapClusterProperties({
        primaryResourceCategory: undefined,
      } as unknown as Parameters<typeof mapPublicMapClusterProperties>[0])
    ).toEqual({
      clusterCategoryCounts: {
        community: 1,
      },
    })
  })

  it("allocates visible cluster dots proportionally to clustered resource types", () => {
    expect(
      resolvePublicMapClusterVisibleCategoryKeys(
        {
          clusterCategoryCounts: {
            food: 5,
            health: 2,
          },
        },
        7
      )
    ).toEqual(["food", "health", "food", "food", "health", "food", "food"])

    expect(
      resolvePublicMapClusterVisibleCategoryKeys(
        {
          clusterCategoryCounts:
            '{"emergency_cooling_centers":1}' as unknown as never,
        },
        4
      )
    ).toEqual([
      "emergency_cooling_centers",
      "emergency_cooling_centers",
      "emergency_cooling_centers",
      "emergency_cooling_centers",
    ])

    expect(
      resolvePublicMapClusterVisibleCategoryKeys(
        {
          clusterCategoryCounts: {
            food: 4,
            health: 3,
            housing: 2,
          },
        },
        7
      )
    ).toEqual([
      "food",
      "health",
      "housing",
      "food",
      "health",
      "housing",
      "food",
    ])
  })

  it("keeps cluster marker chrome free of visible separator rings", () => {
    expect(resolvePublicMapClusterChromePalette("dark")).toMatchObject({
      accent: "#3f3f46",
      dotFill: "rgba(39, 39, 42, 0.58)",
      fill: "rgba(39, 39, 42, 0.48)",
      haloStroke: "rgba(255, 255, 255, 0.15)",
      shadowColor: "rgba(0, 0, 0, 0.24)",
    })
    expect(resolvePublicMapClusterChromePalette("light")).toMatchObject({
      accent: "#3f3f46",
      dotFill: "rgba(39, 39, 42, 0.58)",
      fill: "rgba(39, 39, 42, 0.48)",
      haloStroke: "rgba(255, 255, 255, 0.15)",
      shadowColor: "rgba(0, 0, 0, 0.24)",
    })
    expect(resolvePublicMapClusterChromePalette("dark")).not.toHaveProperty(
      "dotStroke"
    )
    expect(resolvePublicMapClusterChromePalette("dark")).not.toHaveProperty(
      "outerStroke"
    )
    expect(resolvePublicMapClusterChromePalette("dark")).not.toHaveProperty(
      "innerStroke"
    )
  })

  it("keeps equal-count cluster sprite signatures stable across zoom buckets", () => {
    const base = {
      totalCount: 12,
      imageKeys: ["org-a", "org-b", "org-c"],
    }

    expect(resolvePublicMapClusterZoomBucket(9.99)).toBe(9)
    expect(resolvePublicMapClusterZoomBucket(10.01)).toBe(10)
    expect(
      buildPublicMapClusterSignature({ ...base, zoom: 9.99 }).signature
    ).toBe(buildPublicMapClusterSignature({ ...base, zoom: 10.01 }).signature)
  })

  it("builds deterministic fallback cluster sprites at the tier visual size", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const signature = buildPublicMapClusterSignature({
        totalCount: 8,
        imageKeys: ["org-a", "org-b"],
        zoom: 10,
      })

      const sprite = buildPublicMapClusterSprite({ signature })

      expect(sprite).toMatchObject({
        key: signature.imageId,
        pixelRatio: PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
        size: 64,
      })
      expect(sprite?.image.width).toBe(
        64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
      )
      expect(sprite?.image.height).toBe(
        64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
      )
      expect(restoreCanvasMocks.context.scale).toHaveBeenCalledWith(
        PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
        PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
      )
      expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalled()
      expect(restoreCanvasMocks.context.arc).toHaveBeenCalledTimes(9)
      expect(restoreCanvasMocks.context.drawImage).not.toHaveBeenCalled()
    } finally {
      restoreCanvasMocks()
    }
  })

  it("uses radial dot-pack clusters instead of centered counts or avatar slots", () => {
    const rendererSource = readSource(
      "src/lib/public-map/public-map-cluster-sprite-renderer.ts"
    )
    const layoutSource = readSource(
      "src/lib/public-map/public-map-cluster-layout.ts"
    )

    expect(rendererSource).toContain("drawClusterDotPack")
    expect(rendererSource).toContain("computePublicMapClusterCircleLayout")
    expect(rendererSource).toContain("getPublicMapClusterShellMetrics")
    expect(rendererSource).toContain("PUBLIC_MAP_CLUSTER_FALLBACK_DOT_COLORS")
    expect(rendererSource).toContain("visibleCategoryKeys")
    expect(rendererSource).toContain("drawPublicMapResourceCategoryMarkerIcon")
    expect(rendererSource).toContain("PUBLIC_MAP_CLUSTER_DOT_ICON_SCALE = 0.78")
    expect(rendererSource).toContain(
      "iconScale: PUBLIC_MAP_CLUSTER_DOT_ICON_SCALE"
    )
    expect(rendererSource).toContain("minimumIconSize: 0")
    expect(rendererSource).toContain("drawClusterDotBackground")
    expect(rendererSource).toContain("createClusterDotGradient")
    expect(rendererSource).toContain("drawClusterDotHalo")
    expect(rendererSource).not.toContain("drawClusterDotHighlight")
    expect(rendererSource).not.toContain("drawRoundedRect")
    expect(rendererSource).not.toContain("rgba(255, 255, 255, 0.16)")
    expect(rendererSource).not.toContain("rgba(255, 255, 255, 0.26)")
    expect(rendererSource).not.toContain("Math.PI * 1.08")
    expect(rendererSource).not.toContain("Math.PI * 1.92")
    expect(rendererSource).toContain("context.createRadialGradient")
    expect(rendererSource).toContain("context.ellipse")
    expect(rendererSource).toContain("haloStroke")
    expect(rendererSource).toContain("dotFill")
    expect(rendererSource).toContain("PUBLIC_MAP_CLUSTER_DOT_GLOW_ALPHA = 0.52")
    expect(layoutSource).toContain("DIAMETERS_BY_COUNT")
    expect(layoutSource).toContain("SEEDS_BY_COUNT")
    expect(layoutSource).toContain("enforcePairGaps")
    expect(layoutSource).toContain("enforceParentBounds")
    expect(layoutSource).toContain("centerVisualMassIfNeeded")
    expect(layoutSource).toContain("getPublicMapClusterShellMetrics")
    expect(layoutSource).toContain("PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION")
    expect(layoutSource).toContain("BASE_DOT_STROKE_RATIO = 0.024")
    expect(layoutSource).toContain("BASE_MIN_DOT_STROKE_WIDTH = 0.75")
    expect(rendererSource).not.toContain(
      "resolvePublicMapClusterDotSeparatorWidth"
    )
    expect(rendererSource).not.toContain("dotStroke")
    expect(rendererSource).not.toContain("outerStroke")
    expect(rendererSource).not.toContain("innerStroke")
    expect(rendererSource).not.toContain('dotStroke: "rgba(24, 24, 27')
    expect(layoutSource).not.toContain("CLUSTER_DOT_PRESETS")
    expect(layoutSource).not.toContain("createClusterDotFromBaseline")
    expect(rendererSource).not.toContain("drawClusterCount")
    expect(rendererSource).not.toContain("drawClusterAvatarBitmap")
    expect(rendererSource).not.toContain("drawClusterFallbackAvatar")
    expect(rendererSource).not.toContain("#0A84FF")
    expect(rendererSource).not.toContain("#34C759")
    expect(rendererSource).not.toContain("#AF52DE")
    expect(rendererSource).not.toContain("#FF9F0A")
  })

  it("packs cluster dots across the shell with snug non-overlapping spacing", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const scenarios = [
        { count: 1, expectedDots: 1 },
        { count: 2, expectedDots: 2 },
        { count: 3, expectedDots: 3 },
        { count: 4, expectedDots: 4 },
        { count: 5, expectedDots: 5 },
        { count: 6, expectedDots: 6 },
        { count: 7, expectedDots: 7 },
        { count: 8, expectedDots: 7 },
        { count: 20, expectedDots: 7 },
        { count: 24, expectedDots: 7 },
        { count: 100, expectedDots: 7 },
        { count: 120, expectedDots: 7 },
      ]

      for (const scenario of scenarios) {
        restoreCanvasMocks.context.arc.mockClear()
        const signature = buildPublicMapClusterSignature({
          totalCount: scenario.count,
          imageKeys: ["org-a", "org-b"],
          zoom: 10,
        })

        buildPublicMapClusterSprite({ signature })

        const dots = readClusterDotArcs(restoreCanvasMocks.context)
        expect(dots).toHaveLength(scenario.expectedDots)
        expectClusterDotsToFit({ dots, size: signature.tier.size })
      }
    } finally {
      restoreCanvasMocks()
    }
  })

  it("computes deterministic constrained cluster layouts for every count and tier", () => {
    const tierSizes = Object.values(PUBLIC_MAP_CLUSTER_TIERS).map(
      (tier) => tier.size
    )

    for (let count = 1; count <= 7; count += 1) {
      const expectedDotCount = resolveVisiblePublicMapClusterDotCount(count)
      const firstNormalized = getPublicMapClusterNormalizedCircleLayout(count)
      const secondNormalized = getPublicMapClusterNormalizedCircleLayout(count)

      expect(firstNormalized).toBe(secondNormalized)
      expect(firstNormalized).toHaveLength(expectedDotCount)

      const baseline = computePublicMapClusterCircleLayout(
        count,
        PUBLIC_MAP_CLUSTER_LAYOUT_BASE_SIZE
      )
      expectClusterDotsToFit({
        dots: baseline,
        size: PUBLIC_MAP_CLUSTER_LAYOUT_BASE_SIZE,
      })

      const baselineNormalized = normalizeClusterLayoutForSize(
        baseline,
        PUBLIC_MAP_CLUSTER_LAYOUT_BASE_SIZE
      )

      for (const size of tierSizes) {
        const scaled = computePublicMapClusterCircleLayout(count, size)

        expect(scaled).toHaveLength(expectedDotCount)
        expectClusterDotsToFit({ dots: scaled, size })
        expect(normalizeClusterLayoutForSize(scaled, size)).toEqual(
          baselineNormalized
        )
      }
    }
  })

  it("renders category-aware cluster dots from the cluster signature", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const signature = buildPublicMapClusterSignature({
        categoryKeys: ["food", "health", "food"],
        totalCount: 3,
        imageKeys: [],
        zoom: 9,
      })

      buildPublicMapClusterSprite({ signature })

      expect(restoreCanvasMocks.context.createRadialGradient).toHaveBeenCalled()
      expect(
        restoreCanvasMocks.styles.fillStyle.filter(
          (entry) => entry === restoreCanvasMocks.gradient
        )
      ).toHaveLength(3)
      expect(restoreCanvasMocks.styles.fillStyle).toEqual(
        expect.arrayContaining([restoreCanvasMocks.gradient])
      )
      expect(restoreCanvasMocks.styles.fillStyle).toEqual(
        expect.arrayContaining(["#FFFFFF"])
      )
      expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalled()
      expect(restoreCanvasMocks.context.fill).toHaveBeenCalledWith(
        expect.any(Object)
      )
    } finally {
      restoreCanvasMocks()
    }
  })

  it("ignores avatar bitmaps when rendering cluster sprites", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const signature = buildPublicMapClusterSignature({
        totalCount: 3,
        imageKeys: ["org-a"],
        zoom: 8,
      })
      const avatar = {
        height: 64,
        width: 48,
      } as ImageBitmap

      const sprite = buildPublicMapClusterSprite({
        signature,
        avatarBitmaps: [avatar],
      })

      expect(sprite?.key).toBe(signature.imageId)
      expect(sprite?.image.width).toBe(
        64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
      )
      expect(sprite?.image.height).toBe(
        64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
      )
      expect(restoreCanvasMocks.context.drawImage).not.toHaveBeenCalled()
      expect(restoreCanvasMocks.context.fillText).not.toHaveBeenCalled()
      expect(restoreCanvasMocks.context.arc).toHaveBeenCalledTimes(5)
    } finally {
      restoreCanvasMocks()
    }
  })

  it("registers fallback cluster sprites once per signature before async upgrades", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const cache = createPublicMapClusterSpriteCache()
      const map = createImageMapMock()
      const signature = buildPublicMapClusterSignature({
        totalCount: 12,
        imageKeys: ["org-a", "org-b"],
        zoom: 10,
      })

      expect(cache.ensureFallbackSprite({ map, signature })).toEqual({
        imageId: signature.imageId,
        signature: signature.signature,
        status: "added",
        changed: true,
      })
      expect(cache.ensureFallbackSprite({ map, signature })).toEqual({
        imageId: signature.imageId,
        signature: signature.signature,
        status: "cached",
        changed: false,
      })
      expect(map.addImage).toHaveBeenCalledTimes(1)
      expect(map.addImage).toHaveBeenCalledWith(
        signature.imageId,
        expect.objectContaining({
          height: 64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
          width: 64 * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
        }),
        { pixelRatio: PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO }
      )
    } finally {
      restoreCanvasMocks()
    }
  })

  it("does not mutate cluster sprites after the fallback image id exists", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const cache = createPublicMapClusterSpriteCache()
      const map = createImageMapMock()
      const signature = buildPublicMapClusterSignature({
        totalCount: 3,
        imageKeys: ["org-a"],
        zoom: 9,
      })
      const avatar = {
        height: 64,
        width: 64,
      } as ImageBitmap

      expect(
        cache.upgradeSprite({
          map,
          signature,
          avatarBitmaps: [avatar],
        })
      ).toEqual({
        imageId: signature.imageId,
        signature: signature.signature,
        status: "missing",
        changed: false,
      })
      expect(map.updateImage).not.toHaveBeenCalled()

      cache.ensureFallbackSprite({ map, signature })
      expect(
        cache.upgradeSprite({
          map,
          signature,
          avatarBitmaps: [avatar],
        })
      ).toEqual({
        imageId: signature.imageId,
        signature: signature.signature,
        status: "cached",
        changed: false,
      })
      expect(map.updateImage).not.toHaveBeenCalled()
    } finally {
      restoreCanvasMocks()
    }
  })

  it("evicts only cluster sprite cache metadata without removing Mapbox images", () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const cache = createPublicMapClusterSpriteCache({ limit: 1 })
      const map = createImageMapMock()
      const first = buildPublicMapClusterSignature({
        totalCount: 3,
        imageKeys: ["org-a"],
        zoom: 9,
      })
      const second = buildPublicMapClusterSignature({
        totalCount: 12,
        imageKeys: ["org-b", "org-c"],
        zoom: 9,
      })

      cache.ensureFallbackSprite({ map, signature: first })
      cache.ensureFallbackSprite({ map, signature: second })

      expect(cache.has(first)).toBe(false)
      expect(cache.has(second)).toBe(true)
      expect(cache.size).toBe(1)
      expect(map.addImage).toHaveBeenCalledTimes(2)
      expect("removeImage" in map).toBe(false)
    } finally {
      restoreCanvasMocks()
    }
  })

  it("enriches cluster features with fallback sprite ids before source data is applied", async () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
        }),
        buildOrganization({
          id: "org-b",
          longitude: -87.6299,
          latitude: 41.8782,
        }),
        buildOrganization({
          id: "org-c",
          longitude: -87.63,
          latitude: 41.8783,
        }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      const cluster = enriched.features.find(
        (feature) => "cluster" in feature.properties
      )

      expect(cluster?.properties.clusterImageId).toMatch(
        /^public-map-cluster-sprite-/
      )
      expect(cluster?.properties.clusterCategoryCounts).toEqual({
        community: 3,
      })
      expect(cluster?.properties.clusterSignature).toBe(
        `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:light|tier:small|count:3|categories:community,community,community`
      )
      expect(map.addImage).toHaveBeenCalledTimes(1)
      expect(map.updateImage).not.toHaveBeenCalled()
      expect(result.sourceData.features[0]?.properties).not.toHaveProperty(
        "clusterImageId"
      )
      client.destroy()
    } finally {
      restoreCanvasMocks()
    }
  })

  it("orders category-aware cluster colors by dominant resource category", async () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const spriteCache = createPublicMapClusterSpriteCache()
      const [baseFeature] = buildPublicMapPointFeatures([
        buildOrganization({
          id: "org-base",
          longitude: -87.6298,
          latitude: 41.8781,
        }),
      ])
      const features = [
        {
          ...baseFeature!,
          geometry: {
            type: "Point",
            coordinates: [-87.6298, 41.8781],
          },
          properties: {
            ...baseFeature!.properties,
            itemId: "resource-food-a",
            organizationId: "resource-food-a",
            primaryResourceCategory: "food",
          },
        },
        {
          ...baseFeature!,
          geometry: {
            type: "Point",
            coordinates: [-87.6299, 41.8782],
          },
          properties: {
            ...baseFeature!.properties,
            itemId: "resource-food-b",
            organizationId: "resource-food-b",
            primaryResourceCategory: "food",
          },
        },
        {
          ...baseFeature!,
          geometry: {
            type: "Point",
            coordinates: [-87.63, 41.8783],
          },
          properties: {
            ...baseFeature!.properties,
            itemId: "resource-medical-a",
            organizationId: "resource-medical-a",
            primaryResourceCategory: "health",
          },
        },
      ]
      const dataVersion = "category-cluster-test"

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      const cluster = enriched.features.find(
        (feature) => "cluster" in feature.properties
      )

      expect(cluster?.properties.clusterCategoryCounts).toEqual({
        food: 2,
        health: 1,
      })
      expect(cluster?.properties.clusterSignature).toBe(
        `layout:${PUBLIC_MAP_CLUSTER_SPRITE_LAYOUT_VERSION}|theme:light|tier:small|count:3|categories:food,health,food`
      )
      client.destroy()
    } finally {
      restoreCanvasMocks()
    }
  })

  it("keeps cluster sprite ids stable and avoids duplicate addImage calls", async () => {
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
        }),
        buildOrganization({ id: "org-b", longitude: -87.7, latitude: 41.92 }),
        buildOrganization({ id: "org-c", longitude: -87.59, latitude: 41.84 }),
        buildOrganization({ id: "org-d", longitude: -87.67, latitude: 41.81 }),
        buildOrganization({ id: "org-e", longitude: -87.57, latitude: 41.9 }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const first = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      const second = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      const firstCluster = first.features.find(
        (feature) => "cluster" in feature.properties
      )
      const secondCluster = second.features.find(
        (feature) => "cluster" in feature.properties
      )

      expect(firstCluster?.properties.clusterImageId).toBe(
        secondCluster?.properties.clusterImageId
      )
      expect(firstCluster?.properties.clusterSignature).toBe(
        secondCluster?.properties.clusterSignature
      )
      expect(map.addImage).toHaveBeenCalledTimes(1)
      client.destroy()
    } finally {
      restoreCanvasMocks()
    }
  })

  it("renders fallback cluster sprites synchronously before avatar fetch begins", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
          logoUrl: "https://cdn.example.com/a.png",
        }),
        buildOrganization({
          id: "org-b",
          longitude: -87.7,
          latitude: 41.92,
          logoUrl: "https://cdn.example.com/b.png",
        }),
        buildOrganization({
          id: "org-c",
          longitude: -87.59,
          latitude: 41.84,
          logoUrl: "https://cdn.example.com/c.png",
        }),
        buildOrganization({
          id: "org-d",
          longitude: -87.67,
          latitude: 41.81,
          logoUrl: "https://cdn.example.com/d.png",
        }),
        buildOrganization({
          id: "org-e",
          longitude: -87.57,
          latitude: 41.9,
          logoUrl: "https://cdn.example.com/e.png",
        }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      const cluster = enriched.features.find(
        (feature) => "cluster" in feature.properties
      )

      expect(cluster?.properties.clusterImageId).toMatch(
        /^public-map-cluster-sprite-/
      )
      expect(map.addImage).toHaveBeenCalledTimes(1)
      expect(map.updateImage).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
      client.destroy()
    } finally {
      fetchSpy.mockRestore()
      restoreCanvasMocks()
    }
  })

  it("does not asynchronously upgrade cluster sprites with avatar bitmaps", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const source = {
        setData: vi.fn(),
      }
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
          logoUrl: "https://cdn.example.com/a.png",
        }),
        buildOrganization({
          id: "org-b",
          longitude: -87.7,
          latitude: 41.92,
          logoUrl: "https://cdn.example.com/b.png",
        }),
        buildOrganization({
          id: "org-c",
          longitude: -87.59,
          latitude: 41.84,
          logoUrl: "https://cdn.example.com/c.png",
        }),
        buildOrganization({
          id: "org-d",
          longitude: -87.67,
          latitude: 41.81,
          logoUrl: "https://cdn.example.com/d.png",
        }),
        buildOrganization({
          id: "org-e",
          longitude: -87.57,
          latitude: 41.9,
          logoUrl: "https://cdn.example.com/e.png",
        }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })

      await expect(
        upgradePublicMapClusterSpritesWithAvatars({
          clusterClient: client,
          dataVersion,
          map,
          sourceData: enriched,
          spriteCache,
          zoom: 3,
        })
      ).resolves.toEqual([
        expect.objectContaining({
          status: "skipped",
          changed: false,
        }),
      ])

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(map.updateImage).not.toHaveBeenCalled()
      expect(source.setData).not.toHaveBeenCalled()
      await expect(
        upgradePublicMapClusterSpritesWithAvatars({
          clusterClient: client,
          dataVersion,
          map,
          sourceData: enriched,
          spriteCache,
          zoom: 3,
        })
      ).resolves.toEqual([
        expect.objectContaining({
          status: "skipped",
          changed: false,
        }),
      ])
      expect(map.updateImage).not.toHaveBeenCalled()
      client.destroy()
    } finally {
      fetchSpy.mockRestore()
      restoreCanvasMocks()
    }
  })

  it("keeps cluster sprites stable when avatar image requests would fail", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const source = {
        setData: vi.fn(),
      }
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
          logoUrl: "https://cdn.example.com/a.png",
        }),
        buildOrganization({
          id: "org-b",
          longitude: -87.7,
          latitude: 41.92,
          logoUrl: "https://cdn.example.com/b.png",
        }),
        buildOrganization({
          id: "org-c",
          longitude: -87.59,
          latitude: 41.84,
          logoUrl: "https://cdn.example.com/c.png",
        }),
        buildOrganization({
          id: "org-d",
          longitude: -87.67,
          latitude: 41.81,
          logoUrl: "https://cdn.example.com/d.png",
        }),
        buildOrganization({
          id: "org-e",
          longitude: -87.57,
          latitude: 41.9,
          logoUrl: "https://cdn.example.com/e.png",
        }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })

      await expect(
        upgradePublicMapClusterSpritesWithAvatars({
          clusterClient: client,
          dataVersion,
          map,
          sourceData: enriched,
          spriteCache,
          zoom: 3,
        })
      ).resolves.toEqual([
        expect.objectContaining({
          status: "skipped",
          changed: false,
        }),
      ])

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(map.updateImage).not.toHaveBeenCalled()
      expect(source.setData).not.toHaveBeenCalled()
      client.destroy()
    } finally {
      fetchSpy.mockRestore()
      restoreCanvasMocks()
    }
  })

  it("skips stale async cluster sprite upgrades before updateImage", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)
    try {
      const client = createPublicMapClusterClient()
      const map = createImageMapMock()
      const spriteCache = createPublicMapClusterSpriteCache()
      const organizations = [
        buildOrganization({
          id: "org-a",
          longitude: -87.6298,
          latitude: 41.8781,
          logoUrl: "https://cdn.example.com/a.png",
        }),
        buildOrganization({
          id: "org-b",
          longitude: -87.7,
          latitude: 41.92,
          logoUrl: "https://cdn.example.com/b.png",
        }),
        buildOrganization({
          id: "org-c",
          longitude: -87.59,
          latitude: 41.84,
          logoUrl: "https://cdn.example.com/c.png",
        }),
        buildOrganization({
          id: "org-d",
          longitude: -87.67,
          latitude: 41.81,
          logoUrl: "https://cdn.example.com/d.png",
        }),
        buildOrganization({
          id: "org-e",
          longitude: -87.57,
          latitude: 41.9,
          logoUrl: "https://cdn.example.com/e.png",
        }),
      ]
      const dataVersion = buildPublicMapDataVersion(organizations)
      const features = buildPublicMapPointFeatures(organizations)

      await client.build(features, dataVersion)
      const result = await client.getClusters({
        bbox: [-180, -85, 180, 85],
        zoom: 3,
        dataVersion,
        querySeq: 1,
      })
      const enriched = await enrichPublicMapClusterSourceDataWithSprites({
        clusterClient: client,
        dataVersion,
        map,
        sourceData: result.sourceData,
        spriteCache,
        zoom: 3,
      })
      let current = true

      const upgrade = upgradePublicMapClusterSpritesWithAvatars({
        clusterClient: client,
        dataVersion,
        map,
        shouldContinue: () => current,
        sourceData: enriched,
        spriteCache,
        zoom: 3,
      })
      current = false

      await expect(upgrade).resolves.toEqual([
        expect.objectContaining({
          status: "skipped",
          changed: false,
        }),
      ])
      expect(map.updateImage).not.toHaveBeenCalled()
      client.destroy()
    } finally {
      fetchSpy.mockRestore()
      restoreCanvasMocks()
    }
  })

  it("groups exact same-location organizations into one clusterable point", () => {
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "org-a",
        name: "Alpha Org",
        logoUrl: "https://example.com/logo.png",
      }),
      buildOrganization({
        id: "org-b",
        name: "Beta Org",
        logoUrl: "https://example.com/beta.png",
      }),
      buildOrganization({
        id: "org-c",
        longitude: -90,
        latitude: 42,
      }),
      buildOrganization({
        id: "profile-only",
        longitude: null,
        latitude: null,
      }),
    ])

    expect(features).toHaveLength(2)
    expect(features[0]?.properties.sameLocationCount).toBe(2)
    expect(
      parsePublicMapOrganizationIds(features[0]?.properties.organizationIds)
    ).toEqual(["org-a", "org-b"])
    expect(features[0]?.properties.markerImageKey).toMatch(
      new RegExp(`^${resolvePublicMapMarkerImageKey("org-a")}-`)
    )
    expect(features[0]?.properties.markerImageUrl).toBe(
      "https://example.com/logo.png"
    )
    expect(features[1]?.properties.sameLocationCount).toBe(1)
  })

  it("excludes malformed organization coordinates from marker features", () => {
    const features = buildPublicMapPointFeatures([
      buildOrganization({ id: "valid" }),
      buildOrganization({ id: "origin", latitude: 0, longitude: 0 }),
      buildOrganization({ id: "invalid-latitude", latitude: 86 }),
      buildOrganization({ id: "invalid-longitude", longitude: 181 }),
      buildOrganization({ id: "not-finite", latitude: Number.NaN }),
    ])

    expect(
      features.map((feature) => feature.properties.organizationId)
    ).toEqual(["valid"])
  })

  it("derives a stable cluster data version from normalized marker inputs", () => {
    const organizations = [
      buildOrganization({
        id: "org-b",
        longitude: -87.7,
        latitude: 41.9,
        publicSlug: "beta",
      }),
      buildOrganization({
        id: "org-a",
        longitude: -87.6,
        latitude: 41.8,
        publicSlug: "alpha",
      }),
    ]

    const reordered = [organizations[1]!, organizations[0]!]
    expect(buildPublicMapDataVersion(organizations)).toBe(
      buildPublicMapDataVersion(reordered)
    )
    expect(
      buildPublicMapDataVersion([
        organizations[0]!,
        buildOrganization({
          id: "org-a",
          longitude: -87.61,
          latitude: 41.8,
          publicSlug: "alpha",
        }),
      ])
    ).not.toBe(buildPublicMapDataVersion(organizations))
    expect(
      buildPublicMapDataVersion([
        organizations[0]!,
        buildOrganization({
          id: "org-a",
          longitude: -87.6,
          latitude: 41.8,
          publicSlug: "alpha-renamed",
        }),
      ])
    ).not.toBe(buildPublicMapDataVersion(organizations))
    expect(
      buildPublicMapDataVersion([
        organizations[0]!,
        buildOrganization({
          id: "org-a",
          name: "Alpha Org Renamed",
          longitude: -87.6,
          latitude: 41.8,
          publicSlug: "alpha",
        }),
      ])
    ).not.toBe(buildPublicMapDataVersion(organizations))
    expect(
      buildPublicMapDataVersion([
        organizations[0]!,
        buildOrganization({
          id: "org-a",
          logoUrl: "https://example.com/new-logo.png",
          longitude: -87.6,
          latitude: 41.8,
          publicSlug: "alpha",
        }),
      ])
    ).not.toBe(buildPublicMapDataVersion(organizations))
    expect(
      buildPublicMapDataVersion([
        organizations[0]!,
        buildOrganization({
          id: "org-a",
          primaryGroup: "health",
          groups: ["health"],
          longitude: -87.6,
          latitude: 41.8,
          publicSlug: "alpha",
        }),
      ])
    ).not.toBe(buildPublicMapDataVersion(organizations))
  })

  it("falls back to a full-world bbox when padded bounds cross the dateline", () => {
    const map = {
      getZoom: vi.fn().mockReturnValue(12.7),
      getBounds: vi.fn().mockReturnValue({
        getWest: () => 170,
        getEast: () => -170,
        getSouth: () => -80,
        getNorth: () => 80,
      }),
    } as unknown as mapboxgl.Map

    const bbox = resolvePublicMapClusterBbox(map)
    expect(resolvePublicMapClusterZoom(map)).toBe(12)
    expect(bbox[0]).toBe(-180)
    expect(bbox[2]).toBe(180)
    expect(bbox[1]).toBe(-85)
    expect(bbox[3]).toBe(85)
  })

  it("keeps low-zoom western hemisphere bounds queryable when padding exceeds -180", () => {
    const map = {
      getZoom: vi.fn().mockReturnValue(3.15),
      getBounds: vi.fn().mockReturnValue({
        getWest: () => -189.7,
        getEast: () => -3.29,
        getSouth: () => -11.78,
        getNorth: () => 68.07,
      }),
    } as unknown as mapboxgl.Map

    expect(resolvePublicMapClusterBbox(map)).toEqual([
      -180,
      expect.any(Number),
      180,
      expect.any(Number),
    ])
  })

  it("returns clusters for the current viewport bounds", async () => {
    const client = createPublicMapClusterClient()
    const organizations = [
      buildOrganization({
        id: "org-a",
        longitude: -87.6298,
        latitude: 41.8781,
      }),
      buildOrganization({ id: "org-b", longitude: -87.62, latitude: 41.88 }),
      buildOrganization({
        id: "org-c",
        longitude: -118.2437,
        latitude: 34.0522,
      }),
    ]
    const dataVersion = buildPublicMapDataVersion(organizations)
    const features = buildPublicMapPointFeatures(organizations)
    const map = {
      getZoom: vi.fn().mockReturnValue(10.2),
      getBounds: vi.fn().mockReturnValue({
        getWest: () => -88,
        getEast: () => -87,
        getSouth: () => 41,
        getNorth: () => 42,
      }),
    } as unknown as mapboxgl.Map

    await client.build(features, dataVersion)
    const result = await client.getClusters({
      bbox: resolvePublicMapClusterBbox(map),
      zoom: resolvePublicMapClusterZoom(map),
      dataVersion,
      querySeq: 1,
    })

    expect(result.sourceData.features.length).toBeGreaterThan(0)
    expect(
      result.sourceData.features.every((feature) => {
        const [longitude] = feature.geometry.coordinates
        return longitude > -88.3 && longitude < -86.7
      })
    ).toBe(true)
    client.destroy()
  })

  it("skips repeated same viewport queries so setData is not called twice", () => {
    const state = createPublicMapClusterViewportQueryState()
    const setData = vi.fn()
    const bbox: [number, number, number, number] = [-88, 41, -87, 42]
    const first = preparePublicMapClusterViewportQuery({
      state,
      bbox,
      zoom: 10,
      dataVersion: "version-a",
    })
    if (first.shouldQuery) {
      setData({
        type: "FeatureCollection",
        features: [],
      })
    }

    const second = preparePublicMapClusterViewportQuery({
      state,
      bbox,
      zoom: 10,
      dataVersion: "version-a",
    })
    if (second.shouldQuery) {
      setData({
        type: "FeatureCollection",
        features: [],
      })
    }

    expect(first.shouldQuery).toBe(true)
    expect(second.shouldQuery).toBe(false)
    expect(setData).toHaveBeenCalledTimes(1)
  })

  it("treats Mapbox vector tile auth failures as recoverable marker-layer noise", () => {
    const vectorTileError = {
      status: 403,
      url: "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/3/2/3.vector.pbf",
    }

    expect(isRecoverablePublicMapTileError(vectorTileError)).toBe(true)
    expect(resolvePublicMapRuntimeErrorMessage(vectorTileError)).toBeNull()

    expect(
      isRecoverablePublicMapTileError({
        status: 403,
        url: "https://api.mapbox.com/styles/v1/example/private-style",
      })
    ).toBe(false)
    expect(
      resolvePublicMapRuntimeErrorMessage({
        status: 403,
        url: "https://api.mapbox.com/styles/v1/example/private-style",
      })
    ).toBe(MAPBOX_LOAD_ERROR_MESSAGE)
    expect(
      resolvePublicMapRuntimeErrorMessage({
        message:
          'Image "public-map-marker-resource-a" could not be loaded. Make sure you have added the image with map.addImage().',
      })
    ).toBeNull()
    expect(
      resolvePublicMapRuntimeErrorMessage({
        message: "WebGL context lost.",
      })
    ).toBe(MAPBOX_RUNTIME_ERROR_MESSAGE)
  })

  it("returns clusters when the browser worker path is unavailable", async () => {
    const client = createPublicMapClusterClient()
    const features = buildPublicMapPointFeatures([
      buildOrganization({ id: "org-a" }),
      buildOrganization({ id: "org-b", longitude: -87.7 }),
    ])
    const dataVersion = "test-version"

    await expect(client.build(features, dataVersion)).resolves.toEqual({
      dataVersion,
      featureCount: 2,
      reused: false,
    })
    const result = await client.getClusters({
      bbox: [-180, -85, 180, 85],
      zoom: 3,
      dataVersion,
      querySeq: 1,
    })

    expect(result.sourceData.features.length).toBeGreaterThan(0)
    client.destroy()
  })

  it("returns guarded cluster leaves only for the active data version", async () => {
    const client = createPublicMapClusterClient()
    const organizations = [
      buildOrganization({
        id: "org-a",
        longitude: -87.6298,
        latitude: 41.8781,
      }),
      buildOrganization({
        id: "org-b",
        longitude: -87.6299,
        latitude: 41.8782,
      }),
      buildOrganization({ id: "org-c", longitude: -87.63, latitude: 41.8783 }),
    ]
    const dataVersion = buildPublicMapDataVersion(organizations)
    const features = buildPublicMapPointFeatures(organizations)

    await client.build(features, dataVersion)
    const result = await client.getClusters({
      bbox: [-180, -85, 180, 85],
      zoom: 3,
      dataVersion,
      querySeq: 1,
    })
    const cluster = result.sourceData.features.find(
      (feature) => "cluster" in feature.properties
    )
    const clusterId =
      typeof cluster?.properties.cluster_id === "number"
        ? cluster.properties.cluster_id
        : null

    expect(clusterId).not.toBeNull()
    const leaves =
      clusterId === null
        ? []
        : await client.getLeaves(clusterId, 2, dataVersion)
    const staleLeaves =
      clusterId === null
        ? []
        : await client.getLeaves(clusterId, 2, "stale-version")

    expect(leaves).toHaveLength(2)
    expect(leaves.every((leaf) => !("cluster" in leaf.properties))).toBe(true)
    expect(staleLeaves).toEqual([])
    client.destroy()
  })

  it("does not build the worker index twice for the same data version", async () => {
    const workerApi = {
      build: vi.fn(async (_features, dataVersion: string) => ({
        dataVersion,
        featureCount: 2,
        reused: false,
      })),
      getClusters: vi.fn(async ({ dataVersion, querySeq }) => ({
        dataVersion,
        querySeq,
        sourceData: {
          type: "FeatureCollection" as const,
          features: [],
        },
      })),
      getExpansionZoom: vi.fn(),
      getLeaves: vi.fn(),
    }
    const client = createPublicMapClusterClient({ workerApi })
    const features = buildPublicMapPointFeatures([
      buildOrganization({ id: "org-a" }),
      buildOrganization({ id: "org-b", longitude: -87.7 }),
    ])

    await client.build(features, "same-version")
    await client.build(features, "same-version")

    expect(workerApi.build).toHaveBeenCalledTimes(1)
    client.destroy()
  })

  it("passes cluster leaf requests through the worker with the active data version", async () => {
    const workerApi = {
      build: vi.fn(async (_features, dataVersion: string) => ({
        dataVersion,
        featureCount: 1,
        reused: false,
      })),
      getClusters: vi.fn(),
      getExpansionZoom: vi.fn(),
      getLeaves: vi.fn(
        async (_clusterId: number, _limit: number, dataVersion: string) =>
          dataVersion === "active-version"
            ? buildPublicMapPointFeatures([buildOrganization({ id: "org-a" })])
            : []
      ),
    }
    const client = createPublicMapClusterClient({ workerApi })

    await client.build(
      buildPublicMapPointFeatures([buildOrganization({ id: "org-a" })]),
      "active-version"
    )

    await expect(
      client.getLeaves(42, 4, "active-version")
    ).resolves.toHaveLength(1)
    await expect(client.getLeaves(42, 4, "stale-version")).resolves.toEqual([])
    expect(workerApi.getLeaves).toHaveBeenCalledTimes(1)
    expect(workerApi.getLeaves).toHaveBeenCalledWith(42, 4, "active-version")
    client.destroy()
  })

  it("ignores stale cluster query results by data version and query sequence", () => {
    expect(
      shouldUsePublicMapClusterResult(
        {
          dataVersion: "v1",
          querySeq: 1,
        },
        {
          dataVersion: "v1",
          querySeq: 2,
        }
      )
    ).toBe(false)
    expect(
      shouldUsePublicMapClusterResult(
        {
          dataVersion: "v1",
          querySeq: 2,
        },
        {
          dataVersion: "v2",
          querySeq: 2,
        }
      )
    ).toBe(false)
    expect(
      shouldUsePublicMapClusterResult(
        {
          dataVersion: "v2",
          querySeq: 3,
        },
        {
          dataVersion: "v2",
          querySeq: 3,
        }
      )
    ).toBe(true)
  })

  it("prevents an older fallback result from overwriting a newer worker result", () => {
    const latestWorkerResult = {
      dataVersion: "v2",
      querySeq: 8,
    }
    const olderFallbackResult = {
      dataVersion: "v1",
      querySeq: 7,
    }

    expect(
      shouldUsePublicMapClusterResult(olderFallbackResult, latestWorkerResult)
    ).toBe(false)
  })

  it("keeps external resource marker images as category dots without remote image loads", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const map = createImageMapMock()
    const [feature] = buildPublicMapPointFeatures([
      buildOrganization({
        id: "remote-failure",
        logoUrl: "https://cdn.example.com/failure.png",
      }),
    ])
    if (feature) {
      feature.properties.itemType = "external_resource"
      feature.properties.verificationStatus = "external_data"
    }
    const markerImageKey = feature!.properties.markerImageKey
    const onImagesChanged = vi.fn()

    const loads = ensurePublicMapMarkerImages({
      map,
      features: feature ? [feature] : [],
      onImagesChanged,
    })
    await expect(Promise.all(loads)).resolves.toEqual([])

    expect(map.hasImage(markerImageKey)).toBe(true)
    expect(map.hasImage(`${markerImageKey}-selected`)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(onImagesChanged).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("loads marker bitmaps once per image key for future cluster avatar sprites", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)

    const first = getPublicMapMarkerImageBitmap({
      imageKey: "public-map-marker-avatar-cache",
      imageUrl: "https://cdn.example.com/avatar.png",
      fallbackLabel: "Avatar Cache",
    })
    const second = getPublicMapMarkerImageBitmap({
      imageKey: "public-map-marker-avatar-cache",
      imageUrl: "https://cdn.example.com/avatar.png",
      fallbackLabel: "Avatar Cache",
    })

    await expect(first).resolves.toEqual({
      key: "public-map-marker-avatar-cache",
      status: "ready",
      bitmap: expect.objectContaining({
        height: 8,
        width: 8,
      }),
    })
    await expect(second).resolves.toEqual(await first)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("returns a cached fallback bitmap when marker bitmap loading fails", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, blob: vi.fn() } as unknown as Response)

    const first = await getPublicMapMarkerImageBitmap({
      imageKey: "public-map-marker-avatar-fallback",
      imageUrl: "https://cdn.example.com/fallback.png",
      fallbackLabel: "Fallback Org",
    })
    const second = await getPublicMapMarkerImageBitmap({
      imageKey: "public-map-marker-avatar-fallback",
      imageUrl: "https://cdn.example.com/fallback.png",
      fallbackLabel: "Fallback Org",
    })

    expect(first).toEqual({
      key: "public-map-marker-avatar-fallback",
      status: "failed",
      bitmap: expect.objectContaining({
        height: 8,
        width: 8,
      }),
    })
    expect(second).toBe(first)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("refreshes the existing source with the last non-empty collection after marker registration", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)
    const map = createImageMapMock()
    const source = {
      setData: vi.fn(),
    }
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "remote-success",
        logoUrl: "https://cdn.example.com/success.png",
      }),
    ])
    const latestSourceData = {
      type: "FeatureCollection" as const,
      features,
    }

    const loads = ensurePublicMapMarkerImages({
      map,
      features,
      onImagesChanged: () => source.setData(latestSourceData),
    })
    await expect(Promise.all(loads)).resolves.toEqual([
      expect.objectContaining({
        changed: true,
        status: "ready",
      }),
    ])

    expect(source.setData).toHaveBeenCalledWith(latestSourceData)
    expect(source.setData).not.toHaveBeenCalledWith({
      type: "FeatureCollection",
      features: [],
    })
    expect(source.setData).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })

  it("does not duplicate category-dot marker image registration for a ready key", async () => {
    resetPublicMapMarkerImageCachesForTest()
    const restoreCanvasMocks = installPublicMapImageCanvasMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: vi.fn(async () => new Blob(["image"])),
      ok: true,
    } as unknown as Response)
    const map = createImageMapMock()
    const features = buildPublicMapPointFeatures([
      buildOrganization({
        id: "remote-cache",
        logoUrl: "https://cdn.example.com/cache.png",
      }),
    ])

    const firstLoads = ensurePublicMapMarkerImages({ map, features })
    const secondLoads = ensurePublicMapMarkerImages({ map, features })

    expect(secondLoads).toEqual([])
    await Promise.all(firstLoads)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
    restoreCanvasMocks()
  })
})
