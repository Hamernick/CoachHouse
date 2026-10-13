"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

const Dithering = dynamic(
  () => import("@paper-design/shaders-react").then((module) => module.Dithering),
  { ssr: false },
)

/** Shared artwork from the Workspace welcome screen. */
export function OnboardingOrb() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncPreference = () => setReducedMotion(preference.matches)
    syncPreference()
    preference.addEventListener("change", syncPreference)

    const container = containerRef.current
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          setVisible(entry.isIntersecting)
          if (entry.isIntersecting) setStarted(true)
        })
    if (container && observer) observer.observe(container)
    if (!observer) {
      setVisible(true)
      setStarted(true)
    }

    return () => {
      preference.removeEventListener("change", syncPreference)
      observer?.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} aria-hidden="true" className="size-full overflow-hidden bg-[#050816]">
      {started ? (
        <Dithering
          colorBack="#050816"
          colorFront="#13b5ff"
          shape="sphere"
          type="4x4"
          size={2}
          speed={visible && !reducedMotion ? 1 : 0}
          scale={0.6}
          style={{ height: "100%", width: "100%" }}
        />
      ) : null}
    </div>
  )
}
