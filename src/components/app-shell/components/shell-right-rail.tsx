import { useEffect } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

import { RIGHT_RAIL_ID } from "../constants"
import { useRightRailContent } from "../right-rail"

type ShellRightRailProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAutoClose?: (open: boolean) => void
  resizablePanel?: boolean
}

export function ShellRightRail({
  open,
  onOpenChange,
  onAutoClose,
  resizablePanel = false,
}: ShellRightRailProps) {
  const isMobile = useIsMobile()
  const content = useRightRailContent()
  const hasContent = Boolean(content)

  useEffect(() => {
    if (!hasContent && open) {
      if (onAutoClose) {
        onAutoClose(false)
      } else {
        onOpenChange(false)
      }
    }
  }, [hasContent, onAutoClose, onOpenChange, open])

  if (!hasContent) return null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          id={RIGHT_RAIL_ID}
          className="w-full max-w-full gap-0 border-0 p-0 sm:max-w-sm"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-5 pr-16">
            <SheetTitle>Details</SheetTitle>
            <SheetDescription className="sr-only">
              Contextual details for the current workspace view.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      id={RIGHT_RAIL_ID}
      data-state={open ? "open" : "closed"}
      className={cn(
        "relative z-30 hidden h-full shrink-0 flex-col overflow-hidden bg-[var(--shell-bg)] md:flex",
        "transition-[width] duration-180 ease-[cubic-bezier(0.22,1,0.36,1)] contain-layout motion-reduce:transition-none",
        open
          ? resizablePanel
            ? "w-full"
            : "w-[var(--shell-right-rail-width)]"
          : "pointer-events-none w-0"
      )}
    >
      <div
        data-state={open ? "open" : "closed"}
        className={cn(
          "h-full min-h-0 w-full px-[var(--shell-right-rail-pad,var(--shell-rail-padding))] pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
          resizablePanel ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          "transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          "data-[state=closed]:translate-x-2 data-[state=closed]:opacity-0 data-[state=open]:translate-x-0 data-[state=open]:opacity-100"
        )}
      >
        {content}
      </div>
    </aside>
  )
}
