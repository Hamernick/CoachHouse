import { type PublicMapGroupKey } from "@/lib/public-map/groups"
import {
  resolvePublicMapResourceCategoryColor,
  type PublicMapResourceCategoryKey,
} from "@/lib/public-map/resource-categories"

import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import {
  fillPublicMapMarkerFallback,
  publicMapMarkerColorToRgba,
  resolvePublicMapMarkerFallbackAccent,
} from "./public-map-marker-fallback"
import {
  PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
  PUBLIC_MAP_MARKER_CANVAS_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO,
} from "./public-map-marker-canvas-constants"
import { drawPublicMapRoundedRect } from "./public-map-marker-canvas-shapes"
import { drawPublicMapResourceCategoryMarkerIcon } from "./public-map-marker-icons"
import {
  PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY,
  type PublicMapMarkerStyleKey,
  resolvePublicMapMarkerStyleKey,
} from "./public-map-marker-styles"
import { createPublicMapSpecialPillMarkerImage } from "./public-map-special-marker-canvas"
import {
  PUBLIC_MAP_DARK_INPUT_BORDER,
  type PublicMapTheme,
} from "./public-map-theme"

export {
  PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
  PUBLIC_MAP_MARKER_CANVAS_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO,
} from "./public-map-marker-canvas-constants"

type MarkerCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D

type MarkerCanvasDimensions = {
  height: number
  width: number
}

const PUBLIC_MAP_DEFAULT_MARKER_CANVAS_DIMENSIONS = {
  height: PUBLIC_MAP_MARKER_CANVAS_SIZE,
  width: PUBLIC_MAP_MARKER_CANVAS_SIZE,
} satisfies MarkerCanvasDimensions

export type PublicMapMarkerChromeContentKind = "dot" | "image"

type MarkerChromeGeometry = {
  centerX: number
  centerY: number
  contentRadius: number
  outerRadius: number
}

type MarkerChromePalette = {
  badgeFill: string
  badgeStroke: string
  badgeText: string
  haloStroke: string
  iconGlowColor: string
  shadowColor: string
  surfaceAccent: string
  surfaceFill: string
  surfaceStroke: string
}

function createMarkerCanvas(
  dimensions: MarkerCanvasDimensions = PUBLIC_MAP_DEFAULT_MARKER_CANVAS_DIMENSIONS
) {
  const backingWidth = dimensions.width * PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  const backingHeight =
    dimensions.height * PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(backingWidth, backingHeight)
  }
  const canvas = document.createElement("canvas")
  canvas.width = backingWidth
  canvas.height = backingHeight
  return canvas
}

function getMarkerCanvasContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const context = getPublicMapCanvasContext2D(canvas, {
    willReadFrequently: true,
  })
  if (!context) return null

  context.scale(
    PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
    PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  )
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  return context
}

function readMarkerCanvasImageData({
  context,
  dimensions = PUBLIC_MAP_DEFAULT_MARKER_CANVAS_DIMENSIONS,
}: {
  context: MarkerCanvasContext
  dimensions?: MarkerCanvasDimensions
}) {
  return context.getImageData(
    0,
    0,
    dimensions.width * PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
    dimensions.height * PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  )
}

export function resolvePublicMapMarkerChromeGeometry(
  selected: boolean,
  contentKind: PublicMapMarkerChromeContentKind = "dot"
): MarkerChromeGeometry {
  const selectedImage = selected && contentKind === "image"

  return {
    centerX: PUBLIC_MAP_MARKER_CANVAS_SIZE / 2,
    centerY: PUBLIC_MAP_MARKER_CANVAS_SIZE / 2,
    contentRadius: selectedImage ? 22.6 : selected ? 17.2 : 13.8,
    outerRadius: selectedImage ? 27.2 : selected ? 21.8 : 17.2,
  }
}

export function resolvePublicMapMarkerChromePalette(
  theme: PublicMapTheme,
  surfaceColor?: string | null
): MarkerChromePalette {
  const trimmedSurfaceColor = surfaceColor?.trim()
  if (trimmedSurfaceColor) {
    return {
      badgeFill: "rgba(20, 25, 24, 0.96)",
      badgeStroke: publicMapMarkerColorToRgba(trimmedSurfaceColor, 0.62),
      badgeText: "#FFFFFF",
      haloStroke: publicMapMarkerColorToRgba(trimmedSurfaceColor, 0.72),
      iconGlowColor: publicMapMarkerColorToRgba(trimmedSurfaceColor, 0.74),
      shadowColor: publicMapMarkerColorToRgba(
        trimmedSurfaceColor,
        theme === "dark" ? 0.62 : 0.5
      ),
      surfaceAccent: trimmedSurfaceColor,
      surfaceFill: publicMapMarkerColorToRgba(
        trimmedSurfaceColor,
        theme === "dark" ? 0.24 : 0.28
      ),
      surfaceStroke: publicMapMarkerColorToRgba(trimmedSurfaceColor, 0.26),
    }
  }

  if (theme === "dark") {
    const surfaceAccent = "#3f3f46"
    return {
      badgeFill: "rgba(20, 25, 24, 0.96)",
      badgeStroke: "rgba(212, 212, 216, 0.28)",
      badgeText: "#FFFFFF",
      haloStroke: "rgba(212, 212, 216, 0.48)",
      iconGlowColor: "rgba(244, 244, 245, 0.58)",
      shadowColor: "rgba(0, 0, 0, 0.38)",
      surfaceAccent,
      surfaceFill: "rgba(39, 39, 42, 0.52)",
      surfaceStroke: PUBLIC_MAP_DARK_INPUT_BORDER,
    }
  }

  const surfaceAccent = "#2563eb"
  return {
    badgeFill: "rgba(20, 25, 24, 0.96)",
    badgeStroke: "rgba(37, 99, 235, 0.42)",
    badgeText: "#FFFFFF",
    haloStroke: "rgba(37, 99, 235, 0.5)",
    iconGlowColor: "rgba(147, 197, 253, 0.66)",
    shadowColor: "rgba(37, 99, 235, 0.34)",
    surfaceAccent,
    surfaceFill: "rgba(37, 99, 235, 0.16)",
    surfaceStroke: "rgba(255, 255, 255, 0.46)",
  }
}

function createMarkerSurfaceGradient({
  context,
  geometry,
  palette,
  selected,
}: {
  context: MarkerCanvasContext
  geometry: MarkerChromeGeometry
  palette: MarkerChromePalette
  selected: boolean
}) {
  const gradient = context.createRadialGradient(
    geometry.centerX - geometry.outerRadius * 0.08,
    geometry.centerY - geometry.outerRadius * 0.22,
    geometry.outerRadius * 0.1,
    geometry.centerX,
    geometry.centerY,
    geometry.outerRadius * 1.14
  )
  gradient.addColorStop(
    0,
    publicMapMarkerColorToRgba(palette.surfaceAccent, selected ? 0.68 : 0.6)
  )
  gradient.addColorStop(
    0.38,
    publicMapMarkerColorToRgba(palette.surfaceAccent, selected ? 0.62 : 0.54)
  )
  gradient.addColorStop(
    0.72,
    publicMapMarkerColorToRgba(palette.surfaceAccent, selected ? 0.56 : 0.48)
  )
  gradient.addColorStop(
    1,
    publicMapMarkerColorToRgba(palette.surfaceAccent, selected ? 0.48 : 0.4)
  )
  return gradient
}

function drawPublicMapResourceCategoryMarkerIconWithGlow({
  category,
  context,
  geometry,
  glowColor,
  selected,
}: {
  category: PublicMapResourceCategoryKey
  context: MarkerCanvasContext
  geometry: MarkerChromeGeometry
  glowColor: string
  selected: boolean
}) {
  context.save()
  context.shadowColor = glowColor
  context.shadowBlur = selected ? 12 : 10
  context.shadowOffsetY = 0
  drawPublicMapResourceCategoryMarkerIcon({
    category,
    color: "#FFFFFF",
    context,
    geometry,
    selected,
  })
  context.restore()

  context.save()
  context.shadowColor = "rgba(255, 255, 255, 0.72)"
  context.shadowBlur = selected ? 2.6 : 2
  context.shadowOffsetY = 0
  drawPublicMapResourceCategoryMarkerIcon({
    category,
    color: "#FFFFFF",
    context,
    geometry,
    selected,
  })
  context.restore()
}

function drawMarkerHalo({
  context,
  geometry,
  palette,
  selected,
}: {
  context: MarkerCanvasContext
  geometry: MarkerChromeGeometry
  palette: MarkerChromePalette
  selected: boolean
}) {
  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = selected ? 13 : 11
  context.shadowOffsetY = 0
  context.strokeStyle = palette.haloStroke
  context.lineWidth = selected ? 1.28 : 1.12
  context.beginPath()
  context.arc(
    geometry.centerX,
    geometry.centerY,
    geometry.outerRadius + (selected ? 3 : 2.4),
    0,
    Math.PI * 2
  )
  context.stroke()
  context.restore()
}

function drawMarkerChrome({
  contentKind = "dot",
  context,
  selected,
  surfaceColor,
  theme,
}: {
  contentKind?: PublicMapMarkerChromeContentKind
  context: MarkerCanvasContext
  selected: boolean
  surfaceColor?: string | null
  theme: PublicMapTheme
}) {
  const geometry = resolvePublicMapMarkerChromeGeometry(selected, contentKind)
  const palette = resolvePublicMapMarkerChromePalette(theme, surfaceColor)

  context.clearRect(
    0,
    0,
    PUBLIC_MAP_MARKER_CANVAS_SIZE,
    PUBLIC_MAP_MARKER_CANVAS_SIZE
  )

  drawMarkerHalo({ context, geometry, palette, selected })

  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = selected ? 13 : 11
  context.shadowOffsetY = selected ? 2 : 1
  context.fillStyle = createMarkerSurfaceGradient({
    context,
    geometry,
    palette,
    selected,
  })
  context.beginPath()
  context.arc(
    geometry.centerX,
    geometry.centerY,
    geometry.outerRadius,
    0,
    Math.PI * 2
  )
  context.fill()
  context.restore()

  context.save()
  context.beginPath()
  context.arc(
    geometry.centerX,
    geometry.centerY,
    geometry.contentRadius,
    0,
    Math.PI * 2
  )
  context.clip()
}

function finishMarkerChrome({
  context,
  selected,
  sameLocationCount,
  surfaceColor,
  theme,
}: {
  context: MarkerCanvasContext
  selected: boolean
  sameLocationCount?: number
  surfaceColor?: string | null
  theme: PublicMapTheme
}) {
  context.restore()

  drawSameLocationBadge({
    context,
    count: sameLocationCount,
    selected,
    surfaceColor,
    theme,
  })
}

function drawSameLocationBadge({
  context,
  count,
  selected,
  surfaceColor,
  theme,
}: {
  context: MarkerCanvasContext
  count?: number
  selected: boolean
  surfaceColor?: string | null
  theme: PublicMapTheme
}) {
  const normalizedCount =
    typeof count === "number" && Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0
  if (normalizedCount <= 1) return

  const label = normalizedCount > 99 ? "99+" : normalizedCount.toString()
  const height = selected ? 15.5 : 14
  const width = Math.max(height, 8.5 + label.length * 5.8)
  const x = PUBLIC_MAP_MARKER_CANVAS_SIZE - width - (selected ? 9 : 10)
  const y = selected ? 8.7 : 10
  const palette = resolvePublicMapMarkerChromePalette(theme, surfaceColor)
  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = selected ? 9 : 7
  context.shadowOffsetY = 1
  drawPublicMapRoundedRect({
    context,
    x,
    y,
    width,
    height,
    radius: height / 2,
  })
  context.fillStyle = palette.badgeFill
  context.fill()
  context.strokeStyle = palette.badgeStroke
  context.lineWidth = 1
  context.stroke()
  context.fillStyle = palette.badgeText
  context.font =
    "700 7.8px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(label, x + width / 2, y + height / 2 + 0.35)
  context.restore()
}

function drawBitmapCover({
  bitmap,
  context,
  geometry,
}: {
  bitmap: ImageBitmap
  context: MarkerCanvasContext
  geometry: MarkerChromeGeometry
}) {
  const imageWidth = Math.max(1, bitmap.width)
  const imageHeight = Math.max(1, bitmap.height)
  const imageRatio = imageWidth / imageHeight
  const targetDiameter = geometry.contentRadius * 2
  const targetRatio = 1
  const sourceWidth =
    imageRatio > targetRatio ? imageHeight * targetRatio : imageWidth
  const sourceHeight =
    imageRatio > targetRatio ? imageHeight : imageWidth / targetRatio
  const sourceX = (imageWidth - sourceWidth) / 2
  const sourceY = (imageHeight - sourceHeight) / 2

  context.save()
  context.fillStyle = "#FFFFFF"
  context.fillRect(
    0,
    0,
    PUBLIC_MAP_MARKER_CANVAS_SIZE,
    PUBLIC_MAP_MARKER_CANVAS_SIZE
  )
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    geometry.centerX - geometry.contentRadius,
    geometry.centerY - geometry.contentRadius,
    targetDiameter,
    targetDiameter
  )
  context.restore()
}

export function createPublicMapFallbackMarkerImage({
  label,
  markerAccentColor,
  markerStyleKey,
  primaryGroup,
  resourceCategory,
  sameLocationCount,
  selected,
  suppressSelectedCheck = false,
  theme = "light",
  verificationStatus,
}: {
  label: string
  markerAccentColor?: string | null
  markerStyleKey?: PublicMapMarkerStyleKey | null
  primaryGroup?: PublicMapGroupKey | null
  resourceCategory?: PublicMapResourceCategoryKey | null
  sameLocationCount?: number
  selected: boolean
  suppressSelectedCheck?: boolean
  theme?: PublicMapTheme
  verificationStatus?: string | null
}) {
  const resolvedMarkerStyleKey = resolvePublicMapMarkerStyleKey({
    markerStyleKey,
    resourceCategory,
  })
  const usesSpecialPillMarker =
    resolvedMarkerStyleKey === PUBLIC_MAP_SPECIAL_PILL_MARKER_STYLE_KEY &&
    Boolean(resourceCategory)
  const surfaceColor = resourceCategory
    ? resolvePublicMapResourceCategoryColor(resourceCategory)
    : resolvePublicMapMarkerFallbackAccent(primaryGroup, markerAccentColor)
  if (usesSpecialPillMarker && resourceCategory) {
    return createPublicMapSpecialPillMarkerImage({
      label,
      resourceCategory,
      sameLocationCount,
      selected,
      surfaceColor,
      theme,
    })
  }

  const canvas = createMarkerCanvas()
  const context = getMarkerCanvasContext(canvas)
  if (!context) return null
  const geometry = resolvePublicMapMarkerChromeGeometry(selected)

  drawMarkerChrome({ context, selected, surfaceColor, theme })
  fillPublicMapMarkerFallback({
    context,
    drawLabel: !resourceCategory,
    geometry,
    label,
    markerAccentColor,
    primaryGroup,
    selected,
    suppressSelectedCheck,
    verificationStatus,
  })
  if (resourceCategory) {
    const iconPalette = resolvePublicMapMarkerChromePalette(theme, surfaceColor)
    drawPublicMapResourceCategoryMarkerIconWithGlow({
      category: resourceCategory,
      context,
      geometry,
      glowColor: iconPalette.iconGlowColor,
      selected,
    })
  }
  finishMarkerChrome({
    context,
    sameLocationCount,
    selected,
    surfaceColor,
    theme,
  })

  return readMarkerCanvasImageData({ context })
}

export function createPublicMapRemoteMarkerImage({
  bitmap,
  markerAccentColor,
  primaryGroup,
  sameLocationCount,
  selected,
  theme = "light",
  verificationStatus,
}: {
  bitmap: ImageBitmap
  markerAccentColor?: string | null
  primaryGroup?: PublicMapGroupKey | null
  sameLocationCount?: number
  selected: boolean
  theme?: PublicMapTheme
  verificationStatus?: string | null
}) {
  const canvas = createMarkerCanvas()
  const context = getMarkerCanvasContext(canvas)
  if (!context) return null

  const contentKind = "image"
  const geometry = resolvePublicMapMarkerChromeGeometry(selected, contentKind)
  drawMarkerChrome({ contentKind, context, selected, theme })
  drawBitmapCover({
    bitmap,
    context,
    geometry,
  })
  finishMarkerChrome({
    context,
    sameLocationCount,
    selected,
    surfaceColor: null,
    theme,
  })

  return readMarkerCanvasImageData({ context })
}
