"use client"

import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { DrawerHandle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import {
  resolveNextPublicMapDrawerSnapPointIndex,
  type PublicMapDrawerSnapPointIndex,
} from "./sidebar-snap-points"

export function PublicMapDrawerResizeControl({
  activeSnapIndex,
  onSnapIndexChange,
  combined = false,
  dragHandlers,
}: {
  activeSnapIndex: PublicMapDrawerSnapPointIndex
  onSnapIndexChange: (value: PublicMapDrawerSnapPointIndex) => void
  combined?: boolean
  dragHandlers?: Pick<ComponentProps<typeof Button>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture" | "onClickCapture">
}) {
  const nextSnapIndex =
    combined && activeSnapIndex === 2 ? 0 : resolveNextPublicMapDrawerSnapPointIndex(activeSnapIndex)
  const nextSnapLabel = nextSnapIndex === 0 ? "collapsed height" : nextSnapIndex === 2 ? "full height" : "middle height"

  return (
    <Button
      type="button"
      variant="ghost"
      data-public-map-drawer-resize-control=""
      className={cn("focus-visible:ring-ring/45 flex h-auto w-full shrink-0 touch-none justify-center rounded-none px-4 pt-3 pb-2 transition-none hover:bg-transparent hover:text-inherit focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-transparent", combined && "h-7 py-0", combined && activeSnapIndex === 0 && "h-4 pt-3 pb-0")}
      aria-label={`Resize resource map panel to ${nextSnapLabel}`}
      onClick={() => onSnapIndexChange(nextSnapIndex)}
      onKeyDown={(event) => {
        if (!combined || !["ArrowUp", "ArrowDown"].includes(event.key)) return
        event.preventDefault()
        onSnapIndexChange(Math.min(2, Math.max(0, activeSnapIndex + (event.key === "ArrowUp" ? 1 : -1))) as PublicMapDrawerSnapPointIndex)
      }}
      {...dragHandlers}
    >
      {combined ? <span className="bg-foreground/25 h-1 w-12 rounded-full" aria-hidden /> : <DrawerHandle
        className={cn("bg-foreground/18 mt-0 block h-1.5 w-12 rounded-full", combined && "!w-12")}
        preventCycle
      />}
    </Button>
  )
}
