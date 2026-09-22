function resourceLinkHostname(href: string | null | undefined) {
  if (!href) return null
  try {
    const url = new URL(href)
    return /^https?:$/.test(url.protocol)
      ? url.hostname.toLowerCase().replace(/^www\./, "")
      : null
  } catch {
    return null
  }
}

export function resolvePublicMapResourceLinkBranding({
  href,
  websiteHref,
  faviconUrl,
}: {
  href: string
  websiteHref?: string | null
  faviconUrl?: string | null
}) {
  const domain = resourceLinkHostname(href)
  if (!domain) return { domain: null, iconUrls: [] as string[] }

  const preferredIcon =
    domain === resourceLinkHostname(websiteHref) &&
    resourceLinkHostname(faviconUrl)
      ? faviconUrl
      : null
  // Only the hostname goes to the favicon lookup, never link paths or queries.
  const siteIcon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
  return {
    domain,
    iconUrls: [...new Set([preferredIcon, siteIcon].filter(
      (url): url is string => Boolean(url)
    ))],
  }
}
