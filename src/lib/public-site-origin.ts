/** Shared absolute origin for public metadata, profiles, sitemap and robots. */
export function getPublicSiteOrigin(): string {
  const isProduction = process.env.NODE_ENV === "production"
  const fallback = isProduction ? "https://coachhouse.app" : "http://localhost:3000"
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (!isProduction && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    fallback

  try {
    const url = new URL(configured)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return fallback
    }
    // Deployment hosts and local development URLs are never canonical in production.
    if (isProduction && (
      url.protocol !== "https:" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      url.hostname === "vercel.app" ||
      url.hostname.endsWith(".vercel.app")
    )) return fallback
    return url.origin
  } catch {
    return fallback
  }
}
