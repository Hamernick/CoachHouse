import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import type {
  PublicMapClusterSpriteInput,
  PublicMapClusterSpriteResult,
} from "./public-map-cluster-sprites"
import {
  computePublicMapClusterCircleLayout,
  getPublicMapClusterShellMetrics,
} from "./public-map-cluster-layout"
import { drawPublicMapResourceCategoryMarkerIcon } from "./public-map-marker-icons"
import { type PublicMapTheme } from "./public-map-theme"
import {
  resolvePublicMapResourceCategoryColor,
  type PublicMapResourceCategoryKey,
} from "./resource-categories"

export const PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO = 3
const PUBLIC_MAP_CLUSTER_DOT_ICON_SCALE = 0.78
const PUBLIC_MAP_CLUSTER_DOT_GLOW_ALPHA = 0.52
const PUBLIC_MAP_CLUSTER_FALLBACK_DOT_COLORS = [
  "#2563eb",
  "#e11d48",
  "#4f46e5",
  "#0d9488",
  "#db2777",
  "#7c3aed",
  "#0891b2",
] as const

type PublicMapClusterChromePalette = {
  accent: string
  dotFill: string
  fill: string
  haloStroke: string
  shadowColor: string
}

export function buildPublicMapClusterSprite({
  signature,
}: PublicMapClusterSpriteInput): PublicMapClusterSpriteResult | null {
  const canvas = createClusterSpriteCanvas(signature.tier.size)
  const context = getClusterSpriteContext(canvas)
  if (!context) return null

  const scale = PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
  const canvasSize = signature.tier.size * scale
  context.clearRect(0, 0, canvasSize, canvasSize)
  context.scale(scale, scale)

  drawClusterChrome({
    context,
    size: signature.tier.size,
    theme: signature.markerTheme,
  })
  drawClusterDotPack({
    context,
    count: signature.totalCount,
    categoryKeys: signature.visibleCategoryKeys,
    colorKeys: signature.visibleCategoryColors,
    size: signature.tier.size,
    theme: signature.markerTheme,
  })

  const image = context.getImageData(0, 0, canvasSize, canvasSize)
  return {
    image,
    key: signature.imageId,
    pixelRatio: PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO,
    size: signature.tier.size,
  }
}

function createClusterSpriteCanvas(size: number) {
  const canvasSize = size * PUBLIC_MAP_CLUSTER_SPRITE_PIXEL_RATIO
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(canvasSize, canvasSize)
  }
  const canvas = document.createElement("canvas")
  canvas.width = canvasSize
  canvas.height = canvasSize
  return canvas
}

function getClusterSpriteContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  return getPublicMapCanvasContext2D(canvas, { willReadFrequently: true })
}

function drawClusterChrome({
  context,
  size,
  theme,
}: {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  size: number
  theme: PublicMapTheme
}) {
  const metrics = getPublicMapClusterShellMetrics(size)
  const palette = resolvePublicMapClusterChromePalette(theme)
  const haloRadius = Math.min(metrics.shellRadius + 1.6, size / 2 - 0.8)

  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = 8
  context.shadowOffsetY = 0
  context.strokeStyle = palette.haloStroke
  context.lineWidth = 0.92
  context.beginPath()
  context.arc(metrics.center, metrics.center, haloRadius, 0, Math.PI * 2)
  context.stroke()
  context.restore()

  context.save()
  context.shadowColor = palette.shadowColor
  context.shadowBlur = 6
  context.shadowOffsetY = 1
  context.fillStyle = palette.fill
  context.beginPath()
  context.arc(
    metrics.center,
    metrics.center,
    metrics.shellRadius,
    0,
    Math.PI * 2
  )
  context.fill()
  context.restore()
}

function drawClusterDotPack({
  categoryKeys,
  colorKeys,
  context,
  count,
  size,
  theme,
}: {
  categoryKeys: PublicMapResourceCategoryKey[]
  colorKeys: string[]
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  count: number
  size: number
  theme: PublicMapTheme
}) {
  const layout = computePublicMapClusterCircleLayout(count, size)
  const palette = resolvePublicMapClusterChromePalette(theme)
  const dotColors =
    colorKeys.length > 0 ? colorKeys : PUBLIC_MAP_CLUSTER_FALLBACK_DOT_COLORS

  for (let index = 0; index < layout.length; index += 1) {
    const dot = layout[index]!
    const category = categoryKeys[index] ?? null
    const color = category
      ? resolvePublicMapResourceCategoryColor(category)
      : dotColors[index % dotColors.length]!

    if (!category) {
      drawClusterDotBackground({ color, context, dot, palette })
      continue
    }

    drawClusterDotBackground({ color, context, dot, palette })

    if (category) {
      drawClusterDotIcon({
        category,
        color,
        context,
        radius: dot.radius,
        x: dot.x,
        y: dot.y,
      })
    }
  }
}

function toRgba(color: string, alpha: number) {
  const normalized = color.replace("#", "")
  const value = Number.parseInt(normalized, 16)
  if (!Number.isFinite(value)) return `rgba(22, 163, 74, ${alpha})`
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function drawClusterDotBackground({
  color,
  context,
  dot,
  palette,
}: {
  color?: string
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  dot: { x: number; y: number; radius: number }
  palette: PublicMapClusterChromePalette
}) {
  const accent = color ?? palette.accent

  drawClusterDotHalo({ color: accent, context, dot })

  context.save()
  context.shadowColor = toRgba(accent, PUBLIC_MAP_CLUSTER_DOT_GLOW_ALPHA)
  context.shadowBlur = Math.max(4, dot.radius * 0.52)
  context.shadowOffsetY = 0
  context.fillStyle = createClusterDotGradient({ color: accent, context, dot })
  context.beginPath()
  context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function createClusterDotGradient({
  color,
  context,
  dot,
}: {
  color: string
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  dot: { x: number; y: number; radius: number }
}) {
  const gradient = context.createRadialGradient(
    dot.x - dot.radius * 0.08,
    dot.y - dot.radius * 0.22,
    dot.radius * 0.1,
    dot.x,
    dot.y,
    dot.radius * 1.04
  )
  gradient.addColorStop(0, toRgba(color, 0.62))
  gradient.addColorStop(0.38, toRgba(color, 0.56))
  gradient.addColorStop(0.72, toRgba(color, 0.5))
  gradient.addColorStop(1, toRgba(color, 0.42))
  return gradient
}

function drawClusterDotHalo({
  color,
  context,
  dot,
}: {
  color: string
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  dot: { x: number; y: number; radius: number }
}) {
  if (typeof context.ellipse !== "function") return

  const haloWidth = Math.max(0.56, Math.min(0.92, dot.radius * 0.08))
  context.save()
  context.shadowColor = toRgba(color, 0.5)
  context.shadowBlur = Math.max(3, dot.radius * 0.45)
  context.shadowOffsetY = 0
  context.strokeStyle = toRgba(color, 0.5)
  context.lineWidth = haloWidth
  context.beginPath()
  context.ellipse(
    dot.x,
    dot.y,
    dot.radius + haloWidth,
    dot.radius + haloWidth,
    0,
    0,
    Math.PI * 2
  )
  context.stroke()
  context.restore()
}

function drawClusterDotIcon({
  color,
  category,
  context,
  radius,
  x,
  y,
}: {
  category: PublicMapResourceCategoryKey
  color?: string
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  radius: number
  x: number
  y: number
}) {
  context.save()
  context.shadowColor = color
    ? toRgba(color, 0.68)
    : "rgba(255, 255, 255, 0.62)"
  context.shadowBlur = Math.max(4, radius * 0.52)
  context.shadowOffsetY = 0
  drawPublicMapResourceCategoryMarkerIcon({
    category,
    color: "#FFFFFF",
    context,
    geometry: {
      centerX: x,
      centerY: y,
      contentRadius: radius,
    },
    iconScale: PUBLIC_MAP_CLUSTER_DOT_ICON_SCALE,
    minimumIconSize: 0,
    selected: false,
  })
  context.restore()

  context.save()
  context.shadowColor = "rgba(255, 255, 255, 0.72)"
  context.shadowBlur = Math.max(1.6, radius * 0.16)
  context.shadowOffsetY = 0
  drawPublicMapResourceCategoryMarkerIcon({
    category,
    color: "#FFFFFF",
    context,
    geometry: {
      centerX: x,
      centerY: y,
      contentRadius: radius,
    },
    iconScale: PUBLIC_MAP_CLUSTER_DOT_ICON_SCALE,
    minimumIconSize: 0,
    selected: false,
  })
  context.restore()
}

export function resolvePublicMapClusterChromePalette(
  theme: PublicMapTheme
): PublicMapClusterChromePalette {
  void theme
  return {
    accent: "#3f3f46",
    dotFill: "rgba(39, 39, 42, 0.58)",
    fill: "rgba(39, 39, 42, 0.48)",
    haloStroke: "rgba(255, 255, 255, 0.15)",
    shadowColor: "rgba(0, 0, 0, 0.24)",
  }
}
