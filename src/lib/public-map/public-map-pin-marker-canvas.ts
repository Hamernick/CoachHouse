import type { PublicMapGroupKey } from "@/lib/public-map/groups"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"

import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import { resolvePublicMapMarkerFallbackAccent } from "./public-map-marker-fallback"
import {
  PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
  PUBLIC_MAP_MARKER_CANVAS_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO,
} from "./public-map-marker-canvas-constants"
import { drawPublicMapRoundedRect } from "./public-map-marker-canvas-shapes"
import {
  drawPublicMapGenericMarkerIcon,
  drawPublicMapResourceCategoryMarkerIcon,
} from "./public-map-marker-icons"
import type { PublicMapMarkerStyleKey } from "./public-map-marker-styles"
import { resolvePublicMapResourceCategoryColor } from "./resource-categories"
import type { PublicMapTheme } from "./public-map-theme"

export {
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
  PUBLIC_MAP_MARKER_IMAGE_PIXEL_RATIO,
}

const PUBLIC_MAP_PROFILE_IMAGE_BACKGROUND = "#FFFFFF"
const PUBLIC_MAP_PIN_FACE_BORDER_COLOR = "#D1D5DB"
const PUBLIC_MAP_PIN_FACE_BORDER_WIDTH = 0.75

type MarkerCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D

export type PublicMapPinMarkerGeometry = {
  centerX: number
  centerY: number
  contentRadius: number
  outerRadius: number
  pointY: number
}

type PublicMapFallbackPinMarkerInput = {
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
}

type PublicMapRemotePinMarkerInput = {
  bitmap: ImageBitmap
  markerAccentColor?: string | null
  primaryGroup?: PublicMapGroupKey | null
  sameLocationCount?: number
  selected: boolean
  theme?: PublicMapTheme
  verificationStatus?: string | null
}

export function resolvePublicMapPinMarkerGeometry(
  selected: boolean
): PublicMapPinMarkerGeometry {
  return selected
    ? {
        centerX: 36,
        centerY: 33,
        contentRadius: 16,
        outerRadius: 20,
        pointY: 59,
      }
    : {
        centerX: 36,
        centerY: 35,
        contentRadius: 14,
        outerRadius: 18,
        pointY: 58,
      }
}

function createMarkerCanvas() {
  const backingSize =
    PUBLIC_MAP_MARKER_CANVAS_SIZE * PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(backingSize, backingSize)
  }
  const canvas = document.createElement("canvas")
  canvas.width = backingSize
  canvas.height = backingSize
  return canvas
}

function getMarkerCanvasContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const context = getPublicMapCanvasContext2D(canvas, { willReadFrequently: true })
  if (!context) return null

  context.scale(
    PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE,
    PUBLIC_MAP_MARKER_CANVAS_BACKING_SCALE
  )
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  return context
}

function readMarkerCanvasImageData(context: MarkerCanvasContext) {
  return context.getImageData(
    0,
    0,
    PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
    PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE
  )
}

function drawPinSilhouette({
  context,
  geometry,
}: {
  context: MarkerCanvasContext
  geometry: PublicMapPinMarkerGeometry
}) {
  const { centerX, centerY, outerRadius, pointY } = geometry
  const tipRadius = outerRadius * 0.2
  const tipCenterY = pointY - tipRadius
  const centerDistance = tipCenterY - centerY
  const tangentNormalY = (outerRadius - tipRadius) / centerDistance
  const tangentNormalX = Math.sqrt(1 - tangentNormalY * tangentNormalY)
  const headJoinAngle = Math.atan2(tangentNormalY, tangentNormalX)
  const headRightX = centerX + outerRadius * tangentNormalX
  const headRightY = centerY + outerRadius * tangentNormalY
  const headLeftX = centerX - outerRadius * tangentNormalX
  const headLeftY = headRightY
  const tipRightX = centerX + tipRadius * tangentNormalX
  const tipRightY = tipCenterY + tipRadius * tangentNormalY
  const tipLeftX = centerX - tipRadius * tangentNormalX
  const tipLeftY = tipRightY

  context.save()
  context.shadowColor = "rgba(15, 23, 42, 0.26)"
  context.shadowBlur = 6
  context.shadowOffsetY = 2.25
  context.beginPath()
  context.moveTo(headLeftX, headLeftY)
  context.arc(
    centerX,
    centerY,
    outerRadius,
    Math.PI - headJoinAngle,
    headJoinAngle + Math.PI * 2
  )
  context.lineTo(tipRightX, tipRightY)
  context.arc(
    centerX,
    tipCenterY,
    tipRadius,
    headJoinAngle,
    Math.PI - headJoinAngle
  )
  context.lineTo(headLeftX, headLeftY)
  context.closePath()
  context.fillStyle = "#FFFFFF"
  context.fill()
  context.shadowColor = "rgba(0, 0, 0, 0)"
  context.strokeStyle = "rgba(15, 23, 42, 0.14)"
  context.lineWidth = 0.75
  context.stroke()
  context.restore()
}

function beginPinFace({
  color,
  context,
  geometry,
}: {
  color: string
  context: MarkerCanvasContext
  geometry: PublicMapPinMarkerGeometry
}) {
  context.save()
  context.beginPath()
  context.arc(
    geometry.centerX,
    geometry.centerY,
    geometry.contentRadius,
    0,
    Math.PI * 2
  )
  context.fillStyle = color
  context.fill()
  context.clip()
}

function drawPinFaceBorder({
  context,
  geometry,
}: {
  context: MarkerCanvasContext
  geometry: PublicMapPinMarkerGeometry
}) {
  context.save()
  context.beginPath()
  context.arc(
    geometry.centerX,
    geometry.centerY,
    geometry.contentRadius - PUBLIC_MAP_PIN_FACE_BORDER_WIDTH / 2,
    0,
    Math.PI * 2
  )
  context.strokeStyle = PUBLIC_MAP_PIN_FACE_BORDER_COLOR
  context.lineWidth = PUBLIC_MAP_PIN_FACE_BORDER_WIDTH
  context.stroke()
  context.restore()
}

function drawSameLocationBadge({
  context,
  count,
  selected,
}: {
  context: MarkerCanvasContext
  count?: number
  selected: boolean
}) {
  const normalizedCount =
    typeof count === "number" && Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0
  if (normalizedCount <= 1) return

  const label = normalizedCount > 99 ? "99+" : normalizedCount.toString()
  const height = selected ? 15 : 14
  const width = Math.max(height, 8 + label.length * 5.5)
  const x = PUBLIC_MAP_MARKER_CANVAS_SIZE - width - 5
  const y = 4
  context.save()
  context.shadowColor = "rgba(15, 23, 42, 0.22)"
  context.shadowBlur = 4
  context.shadowOffsetY = 1
  drawPublicMapRoundedRect({
    context,
    x,
    y,
    width,
    height,
    radius: height / 2,
  })
  context.fillStyle = "#0F172A"
  context.fill()
  context.fillStyle = "#FFFFFF"
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
  geometry: PublicMapPinMarkerGeometry
}) {
  const imageWidth = Math.max(1, bitmap.width)
  const imageHeight = Math.max(1, bitmap.height)
  const sourceSize = Math.min(imageWidth, imageHeight)
  const sourceX = (imageWidth - sourceSize) / 2
  const sourceY = (imageHeight - sourceSize) / 2
  const diameter = geometry.contentRadius * 2

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    geometry.centerX - geometry.contentRadius,
    geometry.centerY - geometry.contentRadius,
    diameter,
    diameter
  )
}

export function createPublicMapFallbackMarkerImage(
  input: PublicMapFallbackPinMarkerInput
) {
  const canvas = createMarkerCanvas()
  const context = getMarkerCanvasContext(canvas)
  if (!context) return null

  const geometry = resolvePublicMapPinMarkerGeometry(input.selected)
  const faceColor = input.resourceCategory
    ? resolvePublicMapResourceCategoryColor(input.resourceCategory)
    : resolvePublicMapMarkerFallbackAccent(
        input.primaryGroup,
        input.markerAccentColor
      )

  context.clearRect(
    0,
    0,
    PUBLIC_MAP_MARKER_CANVAS_SIZE,
    PUBLIC_MAP_MARKER_CANVAS_SIZE
  )
  drawPinSilhouette({ context, geometry })
  beginPinFace({ color: faceColor, context, geometry })

  if (input.resourceCategory) {
    drawPublicMapResourceCategoryMarkerIcon({
      category: input.resourceCategory,
      color: "#FFFFFF",
      context,
      geometry,
      iconScale: input.selected ? 1.28 : 1.22,
      minimumIconSize: 10,
      selected: input.selected,
    })
  } else {
    drawPublicMapGenericMarkerIcon({
      color: "#FFFFFF",
      context,
      geometry,
      iconScale: input.selected ? 1.28 : 1.22,
      minimumIconSize: 10,
      selected: input.selected,
    })
  }

  context.restore()
  drawPinFaceBorder({ context, geometry })
  drawSameLocationBadge({
    context,
    count: input.sameLocationCount,
    selected: input.selected,
  })
  return readMarkerCanvasImageData(context)
}

export function createPublicMapRemoteMarkerImage(
  input: PublicMapRemotePinMarkerInput
) {
  const canvas = createMarkerCanvas()
  const context = getMarkerCanvasContext(canvas)
  if (!context) return null

  const geometry = resolvePublicMapPinMarkerGeometry(input.selected)
  context.clearRect(
    0,
    0,
    PUBLIC_MAP_MARKER_CANVAS_SIZE,
    PUBLIC_MAP_MARKER_CANVAS_SIZE
  )
  drawPinSilhouette({ context, geometry })
  beginPinFace({
    color: PUBLIC_MAP_PROFILE_IMAGE_BACKGROUND,
    context,
    geometry,
  })
  drawBitmapCover({ bitmap: input.bitmap, context, geometry })
  context.restore()
  drawPinFaceBorder({ context, geometry })
  drawSameLocationBadge({
    context,
    count: input.sameLocationCount,
    selected: input.selected,
  })
  return readMarkerCanvasImageData(context)
}
