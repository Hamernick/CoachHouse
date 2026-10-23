const ORG_MEDIA_MAX_BYTES = 10 * 1024 * 1024
const ORG_MEDIA_ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])

export type OrgMediaKind = "logo" | "logo-mark" | "header" | "roadmap" | "roadmap-inline" | "cover"

export function validateOrgMediaFile(file: File): string | null {
  if (!ORG_MEDIA_ALLOWED.has(file.type)) {
    return "Unsupported image type. Use PNG, JPEG, WebP, or SVG."
  }
  if (file.size > ORG_MEDIA_MAX_BYTES) {
    return "Image too large. Max size is 10 MB."
  }
  return null
}

export async function uploadOrgMedia({ file, kind, organizationId }: { file: File; kind: OrgMediaKind; organizationId?: string }): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`/api/account/org-media?kind=${kind}`, { method: "POST", body: formData, headers: organizationId ? { "x-coach-house-organization-id": organizationId } : undefined })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || "Upload failed")
  }
  const payload = (await res.json()) as { url?: string }
  if (!payload.url) {
    throw new Error("Upload failed")
  }
  return payload.url
}
