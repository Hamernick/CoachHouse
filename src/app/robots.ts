import type { MetadataRoute } from "next"

import { getPublicSiteOrigin } from "@/lib/public-site-origin"

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/internal/", "/workspace/"],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/sitemap-index.xml`],
  }
}
