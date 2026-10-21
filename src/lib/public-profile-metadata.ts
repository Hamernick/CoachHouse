import type { Metadata } from "next"

import type { PublicProfileView } from "@/features/public-profiles"

export function publicOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"

  try {
    return new URL(configured).origin
  } catch {
    return "http://localhost:3000"
  }
}

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
  const canonical = `${publicOrigin()}/${encodeURIComponent(profile.handle)}`
  const images = profile.avatarUrl
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
      card: images ? "summary" : undefined,
      title: profile.displayName,
      description,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
    robots: { index: true, follow: true },
    other: { "profile:username": profile.handle || requestedHandle },
  }
}
