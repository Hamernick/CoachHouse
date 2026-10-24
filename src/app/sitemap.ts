import type { MetadataRoute } from "next"

import { getPublicSiteOrigin } from "@/lib/public-site-origin"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { documentationSitemapEntries } from "@/features/nonprofit-documentation"

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getPublicSiteOrigin()
  const staticEntries: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/build`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/resources`, changeFrequency: "daily", priority: 0.9 },
    ...(publicSharingEnabled
      ? [{ url: `${origin}/community`, changeFrequency: "weekly" as const, priority: 0.7 }]
      : []),
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/status`, changeFrequency: "daily", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...documentationSitemapEntries(origin),
  ]

  return staticEntries
}
