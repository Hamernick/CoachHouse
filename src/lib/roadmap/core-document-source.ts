import type { CoreDocumentDriveSource, RoadmapSection } from "./types"

export function normalizeCoreDocumentDriveSource(
  value: unknown
): CoreDocumentDriveSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (
    source.provider !== "google_drive" ||
    typeof source.fileId !== "string" ||
    !/^[a-zA-Z0-9_-]{10,200}$/.test(source.fileId) ||
    typeof source.name !== "string" ||
    typeof source.webViewLink !== "string"
  )
    return null
  try {
    const url = new URL(source.webViewLink)
    if (
      url.protocol !== "https:" ||
      !["docs.google.com", "drive.google.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null
    return {
      provider: "google_drive",
      fileId: source.fileId,
      name: source.name.slice(0, 500),
      webViewLink: url.toString(),
    }
  } catch {
    return null
  }
}

// An explicit selection wins over a retained inactive source. In particular,
// missing Drive metadata must never fall back to the old editor body.
export function resolveCoreDocumentSource(
  section: Pick<RoadmapSection, "documentSource" | "driveSource">
): "editor" | "google_drive" {
  return section.documentSource ?? (section.driveSource ? "google_drive" : "editor")
}
