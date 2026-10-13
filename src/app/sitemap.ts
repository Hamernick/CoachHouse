import type { MetadataRoute } from "next"

import { fetchPublishedPublicHandles } from "@/lib/queries/public-profile-sitemap"
import { documentationSitemapEntries } from "@/features/nonprofit-documentation"

export const revalidate = 300

function publicOrigin() {
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin()
  const handles = await fetchPublishedPublicHandles()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/resources`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/community`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...documentationSitemapEntries(origin),
  ]

  return [
    ...staticEntries,
    ...handles.map(({ handle, updatedAt }) => ({
      url: `${origin}/${encodeURIComponent(handle)}`,
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
