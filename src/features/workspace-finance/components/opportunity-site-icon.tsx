"use client"

import { useState } from "react"
import { Globe } from "lucide-react"
import grantsGov from "@/lib/assets/grants-gov.webp"

export function getOpportunitySiteIcon(url: string) {
  try {
    const site = new URL(url)
    const host = site.hostname.toLowerCase().replace(/\.$/, "")
    if (!/^https?:$/.test(site.protocol) || site.username || site.password || site.port) return null
    // Only public-looking domain names; never probe local hosts or IP literals.
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || /\.(?:localhost|local|internal|lan|home|test|invalid|example)$/.test(host)) return null
    const cached = host === "grants.gov" || host === "www.grants.gov"
    return { host, src: cached ? (typeof grantsGov === "string" ? grantsGov : grantsGov.src) : `https://${host}/favicon.ico` }
  } catch { return null }
}

export function OpportunitySiteIcon({ url }: { url: string }) {
  const icon = getOpportunitySiteIcon(url)
  const [failed, setFailed] = useState(false)
  if (!icon) return null
  return <span data-opportunity-site-icon title={`Source website: ${icon.host}`} className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50 outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
    {failed ? <Globe aria-hidden="true" className="size-4 text-muted-foreground" /> : (
      // Only the origin's icon is requested; never send the source path/query or referrer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon.src} alt={`Source website: ${icon.host}`} loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="block size-full object-cover" />
    )}
  </span>
}
