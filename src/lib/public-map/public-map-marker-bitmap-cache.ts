import { buildPublicImageTransformUrl } from "@/lib/storage/public-url"

import type { PublicMapGroupKey } from "@/lib/public-map/groups"

import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import {
  createPublicMapFallbackMarkerImage,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE,
} from "./public-map-marker-canvas"
import type { PublicMapTheme } from "./public-map-theme"

const MARKER_BITMAP_CACHE_LIMIT = 240
export const PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE = Math.max(
  512,
  PUBLIC_MAP_MARKER_IMAGE_BACKING_SIZE * 2
)

export type PublicMapMarkerImageBitmapResult = {
  key: string
  status: "ready" | "failed"
  bitmap: ImageBitmap | null
}

export type PublicMapMarkerImageBitmapRequest = {
  imageKey: string
  imageUrl: string | null
  fallbackLabel: string
  markerAccentColor?: string | null
  primaryGroup?: PublicMapGroupKey | null
}

const markerImageBitmapByKey = new Map<
  string,
  Promise<PublicMapMarkerImageBitmapResult>
>()

type MarkerBitmapCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D

export function resetPublicMapMarkerBitmapCacheForTest() {
  markerImageBitmapByKey.clear()
}

function touchMarkerImageBitmapLoad(
  key: string,
  load: Promise<PublicMapMarkerImageBitmapResult>
) {
  if (markerImageBitmapByKey.has(key)) {
    markerImageBitmapByKey.delete(key)
  }
  markerImageBitmapByKey.set(key, load)

  while (markerImageBitmapByKey.size > MARKER_BITMAP_CACHE_LIMIT) {
    const oldest = markerImageBitmapByKey.keys().next().value as
      | string
      | undefined
    if (!oldest) return
    markerImageBitmapByKey.delete(oldest)
  }
}

async function createFallbackMarkerBitmap({
  label,
  markerAccentColor,
  primaryGroup,
  theme = "light",
}: {
  label: string
  markerAccentColor?: string | null
  primaryGroup?: PublicMapGroupKey | null
  theme?: PublicMapTheme
}) {
  const image = createPublicMapFallbackMarkerImage({
    label,
    markerAccentColor,
    primaryGroup,
    selected: false,
    theme,
  })
  if (!image) return null
  try {
    return await createImageBitmap(image)
  } catch {
    return null
  }
}

function createMarkerBitmapCanvas() {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(
      PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE,
      PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE
    )
  }
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE
  canvas.height = PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE
  return canvas
}

function getMarkerBitmapCanvasContext(
  canvas: HTMLCanvasElement | OffscreenCanvas
) {
  const context = getPublicMapCanvasContext2D(canvas, {
    willReadFrequently: true,
  })
  if (!context) return null
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  return context
}

function drawBitmapCoverSquare({
  bitmap,
  context,
}: {
  bitmap: ImageBitmap
  context: MarkerBitmapCanvasContext
}) {
  const imageWidth = Math.max(1, bitmap.width)
  const imageHeight = Math.max(1, bitmap.height)
  const sourceSize = Math.min(imageWidth, imageHeight)
  const sourceX = (imageWidth - sourceSize) / 2
  const sourceY = (imageHeight - sourceSize) / 2

  context.clearRect(
    0,
    0,
    PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE,
    PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE
  )
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE,
    PUBLIC_MAP_MARKER_BITMAP_NORMALIZED_SIZE
  )
}

async function createNormalizedMarkerBitmap(bitmap: ImageBitmap) {
  const canvas = createMarkerBitmapCanvas()
  if (!canvas) return bitmap

  const context = getMarkerBitmapCanvasContext(canvas)
  if (!context) return bitmap

  try {
    drawBitmapCoverSquare({ bitmap, context })
    const normalizedBitmap = await createImageBitmap(canvas)
    bitmap.close?.()
    return normalizedBitmap
  } catch {
    return bitmap
  }
}

async function loadPublicMapMarkerImageBitmap({
  imageKey,
  imageUrl,
  fallbackLabel,
  markerAccentColor,
  primaryGroup,
}: PublicMapMarkerImageBitmapRequest): Promise<PublicMapMarkerImageBitmapResult> {
  if (!imageUrl) {
    return {
      key: imageKey,
      status: "failed",
      bitmap: await createFallbackMarkerBitmap({
        label: fallbackLabel,
        markerAccentColor,
        primaryGroup,
      }),
    }
  }

  try {
    const response = await fetch(buildPublicImageTransformUrl(imageUrl, { width: 144, height: 144, resize: "contain" }) ?? imageUrl, {
      cache: "force-cache",
      mode: "cors",
    })
    if (!response.ok) throw new Error("Marker bitmap request failed.")

    const blob = await response.blob()
    const bitmap = await createNormalizedMarkerBitmap(
      await createImageBitmap(blob)
    )
    return {
      key: imageKey,
      status: "ready",
      bitmap,
    }
  } catch {
    return {
      key: imageKey,
      status: "failed",
      bitmap: await createFallbackMarkerBitmap({
        label: fallbackLabel,
        markerAccentColor,
        primaryGroup,
      }),
    }
  }
}

export function getPublicMapMarkerImageBitmap(
  request: PublicMapMarkerImageBitmapRequest
) {
  const cached = markerImageBitmapByKey.get(request.imageKey)
  if (cached) return cached

  const load = loadPublicMapMarkerImageBitmap(request)
  touchMarkerImageBitmapLoad(request.imageKey, load)
  return load
}
