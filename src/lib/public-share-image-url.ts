import { getPublicSiteOrigin } from "@/lib/public-site-origin"

export const DEFAULT_SHARE_IMAGE_PATH = "/brand-share.png"

export function publicOrganizationShareImageUrl(handle: string, logoUrl: string | null, displayName: string): string {
  let revision = 2166136261
  // A present logo can still fail to load, so include the fallback name unconditionally.
  for (const char of JSON.stringify([logoUrl, displayName])) revision = Math.imul(revision ^ char.charCodeAt(0), 16777619)
  return `${getPublicSiteOrigin()}/${encodeURIComponent(handle)}/share-image.png?v=1-${(revision >>> 0).toString(36)}`
}
