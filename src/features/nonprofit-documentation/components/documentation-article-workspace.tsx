"use client"

import { useEffect, type CSSProperties, type ReactNode } from "react"

export function DocumentationArticleWorkspace({
  guide,
  tool,
  continuation,
}: {
  guide: ReactNode
  tool: ReactNode
  continuation: ReactNode
}) {
  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      const url = new URL(window.location.href)
      const anchor =
        url.hash.slice(1) || (url.searchParams.has("step") ? "sandbox" : "")
      if (!anchor) return
      frame = requestAnimationFrame(() => {
        const target =
          document.getElementById(anchor) ??
          (anchor.startsWith("tool-")
            ? document.getElementById("sandbox")
            : null)
        target?.scrollIntoView({ block: "start" })
      })
    }
    sync()
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])

  return (
    <div

      className="flex w-full min-w-0 flex-col gap-4"
      style={{ "--documentation-anchor-offset": "7rem" } as CSSProperties}
    >
      <div id="guide" className="mx-auto w-full max-w-2xl scroll-mt-28">
        {guide}
      </div>
      {tool}
      <div className="mx-auto w-full max-w-2xl">{continuation}</div>
    </div>
  )
}
