import type { ParticleDocument } from "./particle-file"

/** Browser-owned Google preview. Never put OAuth tokens, app attachment UUIDs,
 * or arbitrary query parameters in an embed URL. Google enforces viewer access.
 * Unsupported links retain Open original instead of guessing a file identity. */
export function particleDrivePreviewUrl(file: ParticleDocument): string | null {
  const source = file.source
  if (source?.kind !== "drive" && source?.kind !== "roadmap_drive") return null
  try {
    const url = new URL(source.webViewLink)
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      !["drive.google.com", "docs.google.com"].includes(url.hostname)
    ) return null
    const match = url.pathname.match(
      /^\/(?:file|document|spreadsheets|presentation|drawings)\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/
    )
    const id = match?.[1] ?? (
      url.hostname === "drive.google.com" && url.pathname === "/open"
        ? url.searchParams.get("id") : null
    )
    if (!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) return null
    if (source.kind === "roadmap_drive" && source.fileId !== id) return null
    const preview = new URL(`https://drive.google.com/file/d/${id}/preview`)
    const resourceKey = url.searchParams.get("resourcekey")
    if (resourceKey && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey))
      preview.searchParams.set("resourcekey", resourceKey)
    return preview.toString()
  } catch {
    return null
  }
}
