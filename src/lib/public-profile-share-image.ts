import sharp from "sharp"

import { fetchPublicProfileByHandle } from "@/lib/queries/public-profile"
import { renderBrandShareImage } from "@/lib/brand-share-image"

const MAX_LOGO_BYTES = 3 * 1024 * 1024
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])

/** Only fetch this project's public uploaded logos; never act as an arbitrary URL proxy. */
export async function loadPublicShareLogo(value: string | null): Promise<string | null> {
  if (!value) return null
  try {
    const url = new URL(value)
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://vswzhuwjtgzrkxknrmxu.supabase.co")
    if (url.protocol !== "https:" || url.origin !== storage.origin || url.username || url.password ||
        !url.pathname.startsWith("/storage/v1/object/public/org-media/")) return null
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(4000) })
    const type = response.headers.get("content-type")?.split(";")[0].trim() ?? ""
    if (!response.ok || !LOGO_TYPES.has(type) || Number(response.headers.get("content-length")) > MAX_LOGO_BYTES) {
      await response.body?.cancel()
      return null
    }
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.length
      if (bytes > MAX_LOGO_BYTES) { await reader.cancel(); return null }
      chunks.push(chunk.value)
    }
    if (!bytes) return null
    const buffer = Buffer.concat(chunks)
    if (type === "image/svg+xml" && /<!DOCTYPE|<!ENTITY|<script|<foreignObject|(?:href\s*=\s*["'](?!#)|url\(\s*["']?(?!#))/i.test(buffer.toString())) return null
    // Decode once with a pixel cap, normalize WebP/SVG and remove embedded metadata.
    const flattened = await sharp(buffer, { limitInputPixels: 16_000_000, animated: false })
      .rotate()
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer()
    // Sharp trims before flattening within one pipeline; use the opaque result.
    const png = await sharp(flattened, { limitInputPixels: 16_000_000 })
      .trim({ background: "#ffffff", threshold: 5 })
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return null
  }
}

export async function servePublicProfileShareImage(handle: string): Promise<Response> {
  const profile = await fetchPublicProfileByHandle(handle)
  // Reuse the public projection: unpublished/private profiles never expose a logo.
  if (!profile || profile.kind !== "organization") {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } })
  }
  const logo = await loadPublicShareLogo(profile.avatarUrl)
  let image: ArrayBuffer
  let usedLogo = Boolean(logo)
  try {
    image = await renderBrandShareImage({ logo, name: profile.displayName }).arrayBuffer()
  } catch {
    usedLogo = false
    image = await renderBrandShareImage({ name: profile.displayName }).arrayBuffer()
  }
  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": usedLogo ? "public, max-age=300, s-maxage=300" : "public, max-age=30, s-maxage=30",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
