import { type PublicMapResourceCategoryKey } from "./resource-categories"
import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import { drawPublicMapResourceCategoryMarkerIcon } from "./public-map-marker-icons"
import {
  PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
  PUBLIC_MAP_SPECIAL_MARKER_CANVAS_HEIGHT,
  PUBLIC_MAP_SPECIAL_MARKER_CANVAS_WIDTH,
  PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT,
  PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH,
} from "./public-map-marker-canvas-constants"
import { drawPublicMapRoundedRect } from "./public-map-marker-canvas-shapes"
import {
  PUBLIC_MAP_DARK_INPUT_BORDER,
  type PublicMapTheme,
} from "./public-map-theme"

type SpecialMarkerCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D

export type PublicMapSpecialPillMarkerChromeGeometry = {
  canvasHeight: number
  canvasWidth: number
  contentRadius: number
  iconBadgeRadius: number
  iconCenterX: number
  iconCenterY: number
  labelMaxWidth: number
  labelX: number
  labelY: number
  outerHeight: number
  outerRadius: number
  outerWidth: number
  outerX: number
  outerY: number
  surfaceStrokeWidth: number
}

export type PublicMapSpecialPillMarkerChromePalette = {
  iconBadgeFill: string
  iconBadgeShadowColor: string
  iconColor: string
  iconGlowColor: string
  shadowColor: string
  surfaceBackdropFill: string
  surfaceFill: string
  surfaceStroke: string
  textColor: string
}

function createSpecialMarkerCanvas() {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(
      PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH,
      PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT
    )
  }
  const canvas = document.createElement("canvas")
  canvas.width = PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH
  canvas.height = PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT
  return canvas
}

function getSpecialMarkerCanvasContext(
  canvas: HTMLCanvasElement | OffscreenCanvas
) {
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

export function resolvePublicMapSpecialPillMarkerChromeGeometry(
  selected: boolean,
  labelWidth = 77
): PublicMapSpecialPillMarkerChromeGeometry {
  const canvasWidth = PUBLIC_MAP_SPECIAL_MARKER_CANVAS_WIDTH
  const canvasHeight = PUBLIC_MAP_SPECIAL_MARKER_CANVAS_HEIGHT
  const outerHeight = selected ? 46 : 42
  const leadingPadding = selected ? 9 : 8
  const trailingPadding = selected ? 13 : 12
  const labelGap = selected ? 11 : 10.5
  const boundedLabelWidth = Math.max(
    1,
    Math.min(labelWidth, selected ? 124 : 120)
  )
  const iconBadgeRadius = selected ? 17 : 15.5
  const outerWidth =
    leadingPadding +
    trailingPadding +
    iconBadgeRadius * 2 +
    labelGap +
    boundedLabelWidth
  const outerX = (canvasWidth - outerWidth) / 2
  const outerY = (canvasHeight - outerHeight) / 2
  const iconCenterX = outerX + leadingPadding + iconBadgeRadius
  const iconCenterY = canvasHeight / 2
  const labelX = iconCenterX + iconBadgeRadius + labelGap

  return {
    canvasHeight,
    canvasWidth,
    contentRadius: selected ? 11.8 : 11.1,
    iconBadgeRadius,
    iconCenterX,
    iconCenterY,
    labelMaxWidth: boundedLabelWidth,
    labelX,
    labelY: iconCenterY + 0.3,
    outerHeight,
    outerRadius: outerHeight / 2,
    outerWidth,
    outerX,
    outerY,
    surfaceStrokeWidth: selected ? 0.76 : 0.62,
  }
}

export function resolvePublicMapSpecialPillMarkerChromePalette(
  _theme: PublicMapTheme,
  selected: boolean,
  _surfaceColor?: string | null
): PublicMapSpecialPillMarkerChromePalette {
  return {
    iconBadgeFill: "#FFFFFF",
    iconBadgeShadowColor: selected
      ? "rgba(0, 0, 0, 0.28)"
      : "rgba(0, 0, 0, 0.22)",
    iconColor: "#38BDF8",
    iconGlowColor: selected
      ? "rgba(56, 189, 248, 0.36)"
      : "rgba(56, 189, 248, 0.28)",
    shadowColor: selected ? "rgba(0, 0, 0, 0.42)" : "rgba(0, 0, 0, 0.34)",
    surfaceBackdropFill: selected
      ? "rgba(24, 24, 27, 0.48)"
      : "rgba(24, 24, 27, 0.42)",
    surfaceFill: selected
      ? "rgba(255, 255, 255, 0.15)"
      : "rgba(255, 255, 255, 0.1)",
    surfaceStroke: PUBLIC_MAP_DARK_INPUT_BORDER,
    textColor: "#FAFAFA",
  }
}

function drawSpecialPillMarkerCapsule({
  context,
  geometry,
}: {
  context: SpecialMarkerCanvasContext
  geometry: PublicMapSpecialPillMarkerChromeGeometry
}) {
  const radius = geometry.outerHeight / 2
  const centerY = geometry.outerY + radius
  const leftCenterX = geometry.outerX + radius
  const rightCenterX = geometry.outerX + geometry.outerWidth - radius

  context.beginPath()
  context.moveTo(leftCenterX, geometry.outerY)
  context.lineTo(rightCenterX, geometry.outerY)
  context.arc(rightCenterX, centerY, radius, -Math.PI / 2, Math.PI / 2)
  context.lineTo(leftCenterX, geometry.outerY + geometry.outerHeight)
  context.arc(leftCenterX, centerY, radius, Math.PI / 2, (Math.PI * 3) / 2)
  context.closePath()
}

function drawSpecialPillMarkerIconBadge({
  context,
  geometry,
  palette,
  selected,
}: {
  context: SpecialMarkerCanvasContext
  geometry: PublicMapSpecialPillMarkerChromeGeometry
  palette: PublicMapSpecialPillMarkerChromePalette
  selected: boolean
}) {
  context.save()
  context.shadowColor = palette.iconBadgeShadowColor
  context.shadowBlur = selected ? 5 : 3
  context.shadowOffsetY = 0
  context.fillStyle = palette.iconBadgeFill
  context.beginPath()
  context.arc(
    geometry.iconCenterX,
    geometry.iconCenterY,
    geometry.iconBadgeRadius,
    0,
    Math.PI * 2
  )
  context.fill()
  context.restore()
}

function drawSpecialPillMarkerIcon({
  context,
  geometry,
  palette,
  resourceCategory,
  selected,
}: {
  context: SpecialMarkerCanvasContext
  geometry: PublicMapSpecialPillMarkerChromeGeometry
  palette: PublicMapSpecialPillMarkerChromePalette
  resourceCategory: PublicMapResourceCategoryKey
  selected: boolean
}) {
  context.save()
  context.shadowColor = palette.iconGlowColor
  context.shadowBlur = selected ? 4 : 3
  context.shadowOffsetY = 0
  drawPublicMapResourceCategoryMarkerIcon({
    category: resourceCategory,
    color: palette.iconColor,
    context,
    geometry: {
      centerX: geometry.iconCenterX,
      centerY: geometry.iconCenterY,
      contentRadius: geometry.contentRadius,
    },
    iconScale: selected ? 1.1 : 1.05,
    selected,
  })
  context.restore()
}

function drawSpecialPillMarkerChrome({
  context,
  labelWidth,
  selected,
  surfaceColor,
  theme,
}: {
  context: SpecialMarkerCanvasContext
  labelWidth: number
  selected: boolean
  surfaceColor?: string | null
  theme: PublicMapTheme
}) {
  const geometry = resolvePublicMapSpecialPillMarkerChromeGeometry(
    selected,
    labelWidth
  )
  const palette = resolvePublicMapSpecialPillMarkerChromePalette(
    theme,
    selected,
    surfaceColor
  )

  context.clearRect(0, 0, geometry.canvasWidth, geometry.canvasHeight)
  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = selected ? 6 : 4
  context.shadowOffsetY = selected ? 2 : 1
  drawSpecialPillMarkerCapsule({ context, geometry })
  context.fillStyle = palette.surfaceBackdropFill
  context.fill()
  context.restore()

  context.save()
  drawSpecialPillMarkerCapsule({ context, geometry })
  context.fillStyle = palette.surfaceFill
  context.fill()
  context.restore()

  context.save()
  drawSpecialPillMarkerCapsule({ context, geometry })
  context.strokeStyle = palette.surfaceStroke
  context.lineWidth = geometry.surfaceStrokeWidth
  context.stroke()
  context.restore()

  return { geometry, palette }
}

function measureMarkerTextWidth(
  context: SpecialMarkerCanvasContext,
  value: string
) {
  if (typeof context.measureText === "function") {
    return context.measureText(value).width
  }

  return value.length * 5.5
}

function truncateSpecialPillMarkerLabel({
  context,
  label,
  maxWidth,
}: {
  context: SpecialMarkerCanvasContext
  label: string
  maxWidth: number
}) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ")
  if (measureMarkerTextWidth(context, normalizedLabel) <= maxWidth) {
    return normalizedLabel
  }

  const ellipsis = "\u2026"
  let truncated = normalizedLabel
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1).trimEnd()
    const candidate = `${truncated}${ellipsis}`
    if (measureMarkerTextWidth(context, candidate) <= maxWidth) {
      return candidate
    }
  }

  return ellipsis
}

function drawSpecialPillMarkerLabel({
  context,
  geometry,
  label,
  palette,
  selected,
}: {
  context: SpecialMarkerCanvasContext
  geometry: PublicMapSpecialPillMarkerChromeGeometry
  label: string
  palette: PublicMapSpecialPillMarkerChromePalette
  selected: boolean
}) {
  context.save()
  context.font = resolveSpecialPillMarkerLabelFont(selected)
  context.fillStyle = palette.textColor
  context.textAlign = "left"
  context.textBaseline = "middle"
  context.fillText(
    truncateSpecialPillMarkerLabel({
      context,
      label,
      maxWidth: geometry.labelMaxWidth,
    }),
    geometry.labelX,
    geometry.labelY
  )
  context.restore()
}

function resolveSpecialPillMarkerLabelFont(selected: boolean) {
  return `${
    selected ? "800 16.8px" : "800 16px"
  } -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
}

function drawSameLocationBadge({
  context,
  count,
  geometry,
  selected,
  theme,
}: {
  context: SpecialMarkerCanvasContext
  count?: number
  geometry: PublicMapSpecialPillMarkerChromeGeometry
  selected: boolean
  theme: PublicMapTheme
}) {
  const normalizedCount =
    typeof count === "number" && Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0
  if (normalizedCount <= 1) return

  const label = normalizedCount > 99 ? "99+" : normalizedCount.toString()
  const height = selected ? 15 : 13
  const width = Math.max(height, 8 + label.length * 6)
  const x = geometry.outerX + geometry.outerWidth - width + 3
  const y = geometry.outerY - 3
  const badgePalette = resolvePublicMapSpecialPillMarkerChromePalette(
    theme,
    selected
  )

  context.save()
  drawPublicMapRoundedRect({ context, x, y, width, height, radius: height / 2 })
  context.fillStyle = "rgba(39, 39, 42, 0.96)"
  context.fill()
  context.strokeStyle = badgePalette.surfaceStroke
  context.lineWidth = 1
  context.stroke()
  context.fillStyle = "#FAFAFA"
  context.font =
    "700 8.25px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(label, x + width / 2, y + height / 2 + 0.35)
  context.restore()
}

export function createPublicMapSpecialPillMarkerImage({
  label: _label,
  resourceCategory,
  sameLocationCount,
  selected,
  surfaceColor,
  theme = "light",
}: {
  label: string
  resourceCategory: PublicMapResourceCategoryKey
  sameLocationCount?: number
  selected: boolean
  surfaceColor?: string | null
  theme?: PublicMapTheme
}) {
  const canvas = createSpecialMarkerCanvas()
  const context = getSpecialMarkerCanvasContext(canvas)
  if (!context) return null
  const markerLabel = "Cooling Center"
  context.font = resolveSpecialPillMarkerLabelFont(selected)
  const labelWidth = measureMarkerTextWidth(context, markerLabel)

  const { geometry, palette } = drawSpecialPillMarkerChrome({
    context,
    labelWidth,
    selected,
    surfaceColor,
    theme,
  })
  drawSpecialPillMarkerIconBadge({ context, geometry, palette, selected })
  drawSpecialPillMarkerIcon({
    context,
    geometry,
    palette,
    resourceCategory,
    selected,
  })
  drawSpecialPillMarkerLabel({
    context,
    geometry,
    label: markerLabel,
    palette,
    selected,
  })
  drawSameLocationBadge({
    context,
    count: sameLocationCount,
    geometry,
    selected,
    theme,
  })

  return context.getImageData(
    0,
    0,
    PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_WIDTH,
    PUBLIC_MAP_SPECIAL_MARKER_IMAGE_BACKING_HEIGHT
  )
}
