"use client"

import { FIND_PATH } from "@/lib/find/routes"

import Link from "next/link"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import type { MouseEvent } from "react"

import type { CanvasSectionId } from "@/components/public/home-canvas-preview-config"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PRODUCT_SECTIONS = new Set<CanvasSectionId>([
  "hero",
  "platform",
  "accelerator",
])

type HomeCanvasProductNavigatorProps = {
  activeSection: CanvasSectionId
  changeSection: (section: CanvasSectionId) => void
  handleFindRouteClick: (event: MouseEvent<HTMLAnchorElement>) => void
  isFindRoutePending: boolean
  primeFindRoute: () => void
}

export function HomeCanvasProductNavigator({
  activeSection,
  changeSection,
  handleFindRouteClick,
  isFindRoutePending,
  primeFindRoute,
}: HomeCanvasProductNavigatorProps) {
  if (!PRODUCT_SECTIONS.has(activeSection)) return null

  return (
    <nav
      data-public-home-product-navigator=""
      aria-label="Coach House product"
      className="pointer-events-auto absolute top-3 left-1/2 z-40 grid min-h-11 w-[min(18rem,calc(100%-1.5rem))] -translate-x-1/2 grid-cols-3 rounded-full border border-white/20 bg-black/45 p-1 text-white shadow-md backdrop-blur-xl sm:top-4"
    >
      <Button
        asChild
        variant={null}
        size="sm"
        className={cn(
          "h-9 rounded-full px-3 text-white",
          activeSection === "hero" && "bg-white text-black"
        )}
      >
        <Link
          href={FIND_PATH}
          prefetch
          aria-current={activeSection === "hero" ? "true" : undefined}
          aria-busy={isFindRoutePending || undefined}
          onClick={handleFindRouteClick}
          onFocus={primeFindRoute}
          onMouseEnter={primeFindRoute}
          onTouchStart={primeFindRoute}
        >
          {isFindRoutePending ? (
            <>
              <LoaderCircleIcon className="animate-spin" aria-hidden />
              <span className="sr-only">Opening Find…</span>
            </>
          ) : (
            "Find"
          )}
        </Link>
      </Button>
      <Button
        type="button"
        variant={null}
        size="sm"
        className={cn(
          "h-9 rounded-full px-3 text-white",
          activeSection === "platform" && "bg-white text-black"
        )}
        aria-pressed={activeSection === "platform"}
        onClick={() => changeSection("platform")}
      >
        Build
      </Button>
      <Button
        type="button"
        variant={null}
        size="sm"
        className={cn(
          "h-9 rounded-full px-3 text-white",
          activeSection === "accelerator" && "bg-white text-black"
        )}
        aria-pressed={activeSection === "accelerator"}
        onClick={() => changeSection("accelerator")}
      >
        Fund
      </Button>
    </nav>
  )
}
