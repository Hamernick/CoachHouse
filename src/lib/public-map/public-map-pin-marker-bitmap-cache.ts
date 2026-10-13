import { buildPublicImageTransformUrl } from "@/lib/storage/public-url"

const PUBLIC_MAP_PIN_BITMAP_CACHE_LIMIT = 240

export type PublicMapPinMarkerBitmapResult = {
  bitmap: ImageBitmap | null
  key: string
  status: "ready" | "failed"
}

const bitmapLoadByKey = new Map<
  string,
  Promise<PublicMapPinMarkerBitmapResult>
>()

function touchBitmapLoad(
  key: string,
  load: Promise<PublicMapPinMarkerBitmapResult>
) {
  if (bitmapLoadByKey.has(key)) bitmapLoadByKey.delete(key)
  bitmapLoadByKey.set(key, load)

  while (bitmapLoadByKey.size > PUBLIC_MAP_PIN_BITMAP_CACHE_LIMIT) {
    const oldestKey = bitmapLoadByKey.keys().next().value as string | undefined
    if (!oldestKey) return
    bitmapLoadByKey.delete(oldestKey)
  }
}

async function loadPublicMapPinMarkerBitmap({
  imageUrl,
  key,
}: {
  imageUrl: string
  key: string
}): Promise<PublicMapPinMarkerBitmapResult> {
  try {
    const response = await fetch(buildPublicImageTransformUrl(imageUrl, { width: 144, height: 144, resize: "contain" }) ?? imageUrl, {
      cache: "force-cache",
      mode: "cors",
    })
    if (!response.ok) throw new Error("Marker image request failed.")

    return {
      bitmap: await createImageBitmap(await response.blob()),
      key,
      status: "ready",
    }
  } catch {
    return {
      bitmap: null,
      key,
      status: "failed",
    }
  }
}

export function getPublicMapPinMarkerBitmap({
  imageUrl,
  key,
}: {
  imageUrl: string
  key: string
}) {
  const cached = bitmapLoadByKey.get(key)
  if (cached) return cached

  const load = loadPublicMapPinMarkerBitmap({ imageUrl, key })
  touchBitmapLoad(key, load)
  return load
}

export function resetPublicMapPinMarkerBitmapCacheForTest() {
  bitmapLoadByKey.clear()
}
