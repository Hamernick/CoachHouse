"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { HomeResource } from "../lib/home-resource-preview"
import { HOME_PREVIEW_ID } from "../lib/home-resource-preview"
import { HomeResourcePreviewSkeleton } from "./home-resource-preview-skeleton"

const Preview = dynamic(() => import("./home-resource-preview-panel").then((module) => module.HomeResourcePreviewPanel), { ssr: false, loading: HomeResourcePreviewSkeleton })

export function HomeResourcePreviewLoader({ organizations }: { organizations: HomeResource[] }) {
  const root = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (window.location.hash === `#${HOME_PREVIEW_ID}` || !("IntersectionObserver" in window)) { setReady(true); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setReady(true); observer.disconnect() } }, { rootMargin: "240px" })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={root} id={HOME_PREVIEW_ID} className="min-w-0 scroll-mt-24">{ready ? <Preview organizations={organizations} /> : <HomeResourcePreviewSkeleton />}</div>
}
