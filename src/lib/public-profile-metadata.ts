import type { Metadata } from "next"

import { getPublicSiteOrigin } from "@/lib/public-site-origin"
import { publicOrganizationShareImageUrl } from "@/lib/public-share-image-url"

import type { PublicProfileView } from "@/features/public-profiles"

export function buildPublicProfileMetadata(
  profile: PublicProfileView | null,
  requestedHandle: string
): Metadata {
  if (!profile) {
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    }
  }

  const description =
    profile.description ??
    profile.headline ??
    `View @${profile.handle} on Coach House.`
  const canonical = `${getPublicSiteOrigin()}/${encodeURIComponent(profile.handle)}`
  const organization = profile.kind === "organization"
  const imageUrl = organization ? publicOrganizationShareImageUrl(profile.handle, profile.avatarUrl) : profile.avatarUrl
  const images = organization
    ? [{ url: publicOrganizationShareImageUrl(profile.handle, profile.avatarUrl), width: 1200, height: 630, type: "image/png", alt: `${profile.displayName} logo` }]
    : profile.avatarUrl
    ? [{ url: profile.avatarUrl, alt: `${profile.displayName} profile image` }]
    : undefined

  return {
    title: profile.displayName,
    description,
    alternates: { canonical },
    openGraph: {
      title: profile.displayName,
      description,
      url: canonical,
      type: "profile",
      images,
    },
    twitter: {
      card: organization ? "summary_large_image" : images ? "summary" : undefined,
      title: profile.displayName,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: { index: true, follow: true },
    other: { "profile:username": profile.handle || requestedHandle },
  }
}
