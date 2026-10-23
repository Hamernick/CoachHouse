import type mapboxgl from "mapbox-gl"

import { getPublicMapCanvasContext2D } from "./public-map-canvas-context"
import {
  PUBLIC_MAP_CLUSTER_BADGE_LARGE_KEY,
  PUBLIC_MAP_CLUSTER_BADGE_MEDIUM_KEY,
  PUBLIC_MAP_CLUSTER_BADGE_SHADOW_LARGE_KEY,
  PUBLIC_MAP_CLUSTER_BADGE_SHADOW_MEDIUM_KEY,
  PUBLIC_MAP_CLUSTER_BADGE_SHADOW_SMALL_KEY,
  PUBLIC_MAP_CLUSTER_BADGE_SMALL_KEY,
  PUBLIC_MAP_POINT_SHADOW_KEY,
} from "./public-map-marker-style"

const POINT_SHADOW_CANVAS_SIZE = 80
const PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE = 2
const PUBLIC_MAP_STATIC_IMAGE_PIXEL_RATIO = 4

function createSizedCanvas(size: number) {
  const backingSize = size * PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(backingSize, backingSize)
  }
  const canvas = document.createElement("canvas")
  canvas.width = backingSize
  canvas.height = backingSize
  return canvas
}

function getCanvasContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const context = getPublicMapCanvasContext2D(canvas, {
    willReadFrequently: true,
  })
  if (!context) return null
  context.scale(
    PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE,
    PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE
  )
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  return context
}

function mapHasImage(map: mapboxgl.Map, key: string) {
  return typeof map.hasImage === "function" && map.hasImage(key)
}

function addImageSafely({
  map,
  key,
  image,
}: {
  map: mapboxgl.Map
  key: string
  image: ImageData
}) {
  try {
    if (mapHasImage(map, key)) return true
    map.addImage(key, image, {
      pixelRatio: PUBLIC_MAP_STATIC_IMAGE_PIXEL_RATIO,
    })
    return true
  } catch {
    return false
  }
}

function createClusterBadgeImage(size: number) {
  const canvas = createSizedCanvas(size)
  const context = getCanvasContext(canvas)
  if (!context) return null

  const center = size / 2
  const radius = center - 3
  context.clearRect(0, 0, size, size)
  context.save()
  context.fillStyle = "rgba(255, 255, 255, 0.98)"
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.fill()
  context.lineWidth = 2
  context.strokeStyle = "rgba(60, 60, 67, 0.18)"
  context.stroke()
  context.restore()

  context.save()
  context.lineWidth = 1
  context.strokeStyle = "rgba(255, 255, 255, 0.88)"
  context.beginPath()
  context.arc(center, center, radius - 2.25, 0, Math.PI * 2)
  context.stroke()
  context.restore()

  return context.getImageData(
    0,
    0,
    size * PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE,
    size * PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE
  )
}

function createSoftShadowImage(size: number, radius: number, opacity = 0.2) {
  const canvas = createSizedCanvas(size)
  const context = getCanvasContext(canvas)
  if (!context) return null

  const center = size / 2
  context.clearRect(0, 0, size, size)
  context.save()
  context.shadowColor = `rgba(15, 23, 42, ${opacity})`
  context.shadowBlur = 10
  context.shadowOffsetY = 3
  context.fillStyle = `rgba(15, 23, 42, ${opacity * 0.46})`
  context.beginPath()
  context.arc(center, center - 1, radius, 0, Math.PI * 2)
  context.fill()
  context.restore()

  return context.getImageData(
    0,
    0,
    size * PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE,
    size * PUBLIC_MAP_STATIC_IMAGE_BACKING_SCALE
  )
}

export function ensurePublicMapBadgeImages(map: mapboxgl.Map) {
  const badges = [
    [PUBLIC_MAP_CLUSTER_BADGE_SMALL_KEY, 68],
    [PUBLIC_MAP_CLUSTER_BADGE_MEDIUM_KEY, 80],
    [PUBLIC_MAP_CLUSTER_BADGE_LARGE_KEY, 96],
  ] as const
  const shadows = [
    [PUBLIC_MAP_CLUSTER_BADGE_SHADOW_SMALL_KEY, 76, 28],
    [PUBLIC_MAP_CLUSTER_BADGE_SHADOW_MEDIUM_KEY, 88, 34],
    [PUBLIC_MAP_CLUSTER_BADGE_SHADOW_LARGE_KEY, 104, 42],
  ] as const

  for (const [key, size] of badges) {
    if (mapHasImage(map, key)) continue
    const image = createClusterBadgeImage(size)
    if (image) addImageSafely({ map, key, image })
  }

  for (const [key, size, radius] of shadows) {
    if (mapHasImage(map, key)) continue
    const image = createSoftShadowImage(size, radius)
    if (image) addImageSafely({ map, key, image })
  }

  if (mapHasImage(map, PUBLIC_MAP_POINT_SHADOW_KEY)) return

  const pointShadow = createSoftShadowImage(POINT_SHADOW_CANVAS_SIZE, 22, 0.18)
  if (!pointShadow) return
  addImageSafely({
    map,
    key: PUBLIC_MAP_POINT_SHADOW_KEY,
    image: pointShadow,
  })
}
