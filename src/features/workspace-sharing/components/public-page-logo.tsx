"use client"

import { useState } from "react"
import { pageBrandStyle } from "../lib/page-brand"

/** Same reviewed, revocable image endpoint as page content; never a private URL. */
export function PublicPageLogo({ src, name, primaryColor }: { src?: string; name: string; primaryColor?: string }) {
  const [failed, setFailed] = useState(false)
  return <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-medium" style={pageBrandStyle(primaryColor)} aria-hidden>
    {src && !failed
      // eslint-disable-next-line @next/next/no-img-element -- each request must authorize the committed asset
      ? <img src={src} alt="" width={44} height={44} decoding="async" referrerPolicy="no-referrer" className="size-full object-contain" onError={() => setFailed(true)} />
      : name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}
  </span>
}
