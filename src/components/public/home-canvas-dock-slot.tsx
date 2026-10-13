"use client"

import { createContext } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const HOME_SEARCH_DOCK_SURFACE_CLASSNAME =
  "pointer-events-auto z-40 mx-auto w-full max-w-2xl rounded-[28px] border border-border bg-card p-2 pt-1 text-card-foreground shadow-none backdrop-blur-2xl supports-[backdrop-filter]:bg-card/80"

// Undefined keeps the existing floating presentation; null waits for the shell host.
export const HomeCanvasDockHostContext = createContext<HTMLElement | null | undefined>(undefined)

export function HomeCanvasSearchDockSkeleton() {
  return (
    <div
      data-public-map-search-dock-loading=""
      role="status"
      aria-label="Loading search controls"
      className={HOME_SEARCH_DOCK_SURFACE_CLASSNAME}
    >
      <span className="sr-only">Loading search controls…</span>
      <div aria-hidden="true">
        <div className="flex h-12 items-center justify-between px-1 pb-1">
          <Skeleton className="h-5 w-24 rounded-full motion-reduce:animate-none" />
          <Skeleton className="mx-1.5 size-8 rounded-full motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-12 w-full rounded-full motion-reduce:animate-none" />
      </div>
    </div>
  )
}
