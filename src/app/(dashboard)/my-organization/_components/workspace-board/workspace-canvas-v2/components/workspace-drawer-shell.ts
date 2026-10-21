
import { cn } from "@/lib/utils"
import styles from "./workspace-dock.module.css"

export const FLOATING_PANEL_CLASS = cn(
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

export function drawerClassName(drawerFullscreen: boolean) {
  return cn(
    "border-border/70 bg-background/98 absolute right-0 bottom-0 left-0 !z-20 h-full max-h-full w-full max-w-full min-h-0 min-w-0 box-border overflow-hidden p-0 shadow-[0_-24px_70px_-42px_hsl(var(--foreground)/0.55)] backdrop-blur-xl",
    "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-full data-[vaul-drawer-direction=bottom]:max-h-full data-[vaul-drawer-direction=bottom]:rounded-t-[20px]",
    drawerFullscreen &&
      "bg-background !z-40 backdrop-blur-none data-[vaul-drawer-direction=bottom]:rounded-t-none data-[vaul-drawer-direction=bottom]:border-t-0"
  )
}
