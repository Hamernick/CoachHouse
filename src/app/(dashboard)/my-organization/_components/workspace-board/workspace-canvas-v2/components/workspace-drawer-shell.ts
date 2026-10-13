import type { HTMLAttributes } from "react"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"
import styles from "./workspace-dock.module.css"

export const DOCK_SHELL_OWNER_PROPS = getReactGrabOwnerProps({
  ownerId: "workspace-canvas:dock-shell",
  component: "WorkspaceCanvasOverlayDrawer",
  source:
    "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer.tsx",
  tokenSource:
    "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock.module.css",
  primitiveImport: "@/components/ui/drawer",
})

// A browser may match :focus-visible for programmatic focus on initial mount.
// Only keyboard interaction should opt the passive dock host into a panel ring.
export const DOCK_FOCUS_HANDLERS: Pick<
  HTMLAttributes<HTMLDivElement>,
  "onKeyDownCapture" | "onPointerDownCapture" | "onBlurCapture"
> = {
  onKeyDownCapture: (event) => {
    event.currentTarget.dataset.keyboardFocus = "true"
  },
  onPointerDownCapture: (event) => {
    delete event.currentTarget.dataset.keyboardFocus
  },
  onBlurCapture: (event) => {
    if (!event.currentTarget.contains(event.relatedTarget))
      delete event.currentTarget.dataset.keyboardFocus
  },
}

export const FLOATING_PANEL_CLASS = cn(
  "bg-background/98 border-border/70 pointer-events-auto flex flex-col overflow-hidden rounded-[28px] border shadow-none backdrop-blur-xl",
  styles.panel
)

export function resolveDrawerExpandLabel(
  particleComposer: boolean,
  drawerCollapsed: boolean,
  drawerFullscreen: boolean
) {
  return particleComposer
    ? drawerCollapsed
      ? "Expand workspace"
      : drawerFullscreen
        ? "Collapse workspace"
        : "Expand fully"
    : drawerFullscreen
      ? "Restore data drawer height"
      : "Expand data drawer to full canvas height"
}

export function floatingShellStyle(canvasHeight: number) {
  return { bottom: 16, height: canvasHeight - 32, width: "calc(100% - 24px)" }
}

export function drawerClassName(
  particleComposer: boolean,
  drawerFullscreen: boolean
) {
  return cn(
    "border-border/70 bg-background/98 absolute right-0 bottom-0 left-0 !z-20 h-full max-h-full w-full max-w-full min-h-0 min-w-0 box-border overflow-hidden p-0 shadow-[0_-24px_70px_-42px_hsl(var(--foreground)/0.55)] backdrop-blur-xl",
    "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-full data-[vaul-drawer-direction=bottom]:max-h-full data-[vaul-drawer-direction=bottom]:rounded-t-[20px]",
    particleComposer &&
      "pointer-events-none mx-auto !max-w-[clamp(460px,48%,520px)] !overflow-visible !border-0 !bg-transparent !shadow-none !backdrop-blur-none motion-reduce:!transition-none",
    particleComposer && styles.floatingShell,
    drawerFullscreen &&
      "bg-background !z-40 backdrop-blur-none data-[vaul-drawer-direction=bottom]:rounded-t-none data-[vaul-drawer-direction=bottom]:border-t-0"
  )
}
