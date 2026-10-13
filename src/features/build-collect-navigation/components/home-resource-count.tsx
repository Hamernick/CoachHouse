"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

const FALLBACK = "Find resources in your area."
const RollingCount = dynamic(
  () => import("./home-resource-rolling-count").then((module) => module.HomeResourceRollingCount),
  { ssr: false, loading: () => <>{FALLBACK}</> }
)

export function HomeResourceCount() {
  const root = useRef<HTMLParagraphElement>(null)
  const [started, setStarted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)

  useEffect(() => {
    const start = () => {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setStarted(true)
    }
    if (!("IntersectionObserver" in window)) { start(); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      start()
      observer.disconnect()
    }, { threshold: 0.5 })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  return (
    <p ref={root} data-home-resource-count="" className="text-muted-foreground mx-auto mt-2 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl">
      {started ? <RollingCount reducedMotion={reducedMotion} /> : FALLBACK}
    </p>
  )
}
