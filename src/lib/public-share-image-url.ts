import { getPublicSiteOrigin } from "@/lib/public-site-origin"

export const DEFAULT_SHARE_IMAGE_PATH = "/brand-share.png"

export function publicOrganizationShareImageUrl(handle: string, logoUrl: string | null = null): string {
  let revision = 2166136261
  for (const char of logoUrl ?? "") revision = Math.imul(revision ^ char.charCodeAt(0), 16777619)
  return `${getPublicSiteOrigin()}/${encodeURIComponent(handle)}/share-image.png?v=1-${(revision >>> 0).toString(36)}`
}
