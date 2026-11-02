"use client"

import { useState } from "react"

/** Native image fetch: never send revocable bytes through Next's persistent
 * image optimizer. The endpoint independently checks the current audience. */
export function PublicPageImage({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <p className="text-muted-foreground text-sm" role="status">Image unavailable. Reload the page.</p>
  // eslint-disable-next-line @next/next/no-img-element -- authorization must run for each request
  return <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    className="block h-auto max-h-[36rem] w-full rounded-xl object-contain" onError={() => setFailed(true)} />
}
