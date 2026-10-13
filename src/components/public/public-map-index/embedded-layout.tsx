"use client"

import { useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { useCollapsingMap } from "./use-collapsing-map"

import { PublicMapEmbeddedBackdrop } from "./embedded-map-backdrop"
import { usePublicMapPageScroll } from "./use-public-map-page-scroll"
import { EmbeddedProfileActiveContext } from "./embedded-profile"
import "./embedded-layout.css"

export function PublicMapEmbeddedLayout({
  contentActive = false,
  map,
  panel,
  toolbar,
  profile,
}: {
  contentActive?: boolean
  map: ReactNode
  panel: ReactNode
  toolbar: ReactNode
  profile?: ReactNode
}) {
  const screenRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  usePublicMapPageScroll(contentRef)
  const { pinned, compact } = useCollapsingMap(screenRef, contentRef, contentActive)

  // Keep the map inside the established screen; surrounding glass stays separate.
  return (
    <EmbeddedProfileActiveContext.Provider value={contentActive}>
    <div ref={contentRef} className={cn("public-map-embedded-layout", "pointer-events-none mx-auto flex w-full max-w-5xl min-w-0 flex-col items-center gap-2")}>
      <PublicMapEmbeddedBackdrop screenRef={screenRef} contentRef={contentRef} screenVisible={!contentActive} />
      <div data-public-map-pinned={pinned ? "" : undefined} data-compact={compact} aria-hidden={contentActive || undefined} inert={contentActive || undefined} className={cn(contentActive ? "pointer-events-none invisible h-0 w-full overflow-hidden" : "w-full max-w-2xl shrink-0", pinned && !contentActive && "sticky top-0 z-30 pb-2")}>
        <Card data-public-map-card="" className="pointer-events-auto gap-0 rounded-[32px] shadow-none">
        <CardHeader data-public-map-toolbar="" className="relative z-20 flex min-h-12 flex-row items-center justify-between gap-3 px-3 py-2">
          {toolbar}
        </CardHeader>
        <CardContent data-public-map-explorer="" className="flex min-w-0 flex-col items-center p-2 pt-0">
          {/* Keep the map above the surrounding blur so its edges cannot bleed into it. */}
          <div
            ref={screenRef}
            data-public-map-screen=""
            data-public-map-screen-mode={contentActive ? "content" : "map"}
            className={cn("relative z-20 aspect-video w-full min-w-0 rounded-3xl", pinned && "overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none")}
            style={pinned ? { maxHeight: `var(--map-results-height, ${compact ? "clamp(7rem, calc(var(--map-expanded-height) * 0.5), 11.25rem)" : "var(--map-expanded-height)"})` } : undefined}
          >
            <div className={pinned ? "absolute top-1/2 w-full -translate-y-1/2 aspect-video" : "absolute inset-0"}>{map}</div>
            <div aria-hidden="true" className="border-border pointer-events-none absolute inset-0 z-[60] rounded-3xl border" />
          </div>
        </CardContent>
        </Card>
      </div>
      {contentActive ? profile : null}
      <div data-public-map-explorer-panel="" className={`pointer-events-auto relative z-20 flex w-full max-w-2xl min-h-0 min-w-0 flex-col ${contentActive ? "h-0" : ""}`}>
        {panel}
      </div>
    </div>
    </EmbeddedProfileActiveContext.Provider>
  )
}
