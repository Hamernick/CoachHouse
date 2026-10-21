"use client"

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import RefreshIcon from "lucide-react/dist/esm/icons/refresh-cw"
import MinimizeIcon from "lucide-react/dist/esm/icons/minimize-2"
import {
  Dialog,
  DialogPortal,
  DialogTitle,
  DialogSurface,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WORKSPACE_CANVAS_STAGED_EASE } from "@/lib/workspace-canvas/motion-spec"
import { useParticleSurface } from "./particle-surface"

export function ParticleFileViewer({
  open,
  onOpenChange,
  title,
  url,
  origin,
  onRefresh,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url?: string | null
  origin: RefObject<HTMLElement | null>
  children: ReactNode
  onRefresh?: () => void
}) {
  const reduced = useReducedMotion()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const surface = useParticleSurface()
  useLayoutEffect(() => {
    if (open)
      setContainer(
        origin.current?.closest<HTMLElement>(
          "[data-workspace-canvas-flow-frame]"
        ) ??
          document.querySelector<HTMLElement>(
            "[data-workspace-canvas-flow-frame]"
          )
      )
  }, [open, origin])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal container={container ?? undefined} forceMount>
        <AnimatePresence>
          {open && (
            <DialogSurface
              forceMount
              asChild
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                origin.current
                  ?.closest("article")
                  ?.querySelector<HTMLButtonElement>(
                    'button[aria-haspopup="menu"]'
                  )
                  ?.focus({ preventScroll: true })
              }}
            >
              <motion.section
                {...surface()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className={`nodrag nopan nowheel ${container ? "absolute" : "fixed"} border-border bg-background inset-0 z-[60] flex min-h-0 flex-col overflow-hidden rounded-[22px] border outline-none`}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.985 }}
                transition={{
                  duration: reduced ? 0 : 0.18,
                  ease: WORKSPACE_CANVAS_STAGED_EASE,
                }}
              >
                <header className="border-border/60 flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                  <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">
                    {title}
                  </DialogTitle>
                  {onRefresh && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full sm:size-8"
                      aria-label="Refresh Google Drive preview"
                      title="Refresh preview"
                      onClick={onRefresh}
                    >
                      <RefreshIcon className="size-4" />
                    </Button>
                  )}
                  {url && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        Open original
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-full sm:size-8"
                    aria-label="Exit full screen"
                    onClick={() => onOpenChange(false)}
                  >
                    <MinimizeIcon className="size-4" />
                  </Button>
                </header>
                <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                  {children}
                </div>
              </motion.section>
            </DialogSurface>
          )}
        </AnimatePresence>
      </DialogPortal>
    </Dialog>
  )
}
