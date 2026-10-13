"use client"

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react"
import { MediaActivityProvider } from "@/components/media/media-activity"
import { cn } from "@/lib/utils"
import { TabsContent } from "@/components/ui/tabs"
import type {
  WorkspaceCanvasDrawerTab,
  WorkspaceDataDrawerRequest,
} from "./workspace-canvas-overlay-drawer-tabs"

// A visited module owns its same DOM and local draft for this workspace session.
// Unvisited modules do not mount or fetch. No second hidden desktop content tree.
export function WorkspaceRetainedPanel({
  activeTab,
  visible = true,
  present = visible,
  value,
  children,
  ...props
}: Omit<ComponentProps<typeof TabsContent>, "value"> & {
  activeTab: WorkspaceCanvasDrawerTab
  visible?: boolean
  present?: boolean
  value: WorkspaceCanvasDrawerTab
}) {
  const active = activeTab === value && visible
  const painted = activeTab === value && present
  const [visited, setVisited] = useState(active)
  const viewport = useRef<HTMLDivElement>(null)
  const scrollTop = useRef(0)
  if (active && !visited) setVisited(true)
  useLayoutEffect(() => {
    if (active && viewport.current) {
      viewport.current.scrollTop = scrollTop.current
    } else {
      viewport.current
        ?.querySelectorAll<HTMLMediaElement>("video, audio")
        .forEach((media) => media.pause())
    }
  }, [active])
  if (!visited && !active) return null
  return (
    <TabsContent
      {...props}
      ref={viewport}
      value={value}
      forceMount
      hidden={!painted}
      aria-hidden={!active}
      className={cn(props.className, !painted && "hidden")}
      inert={!active ? true : undefined}
      onScroll={(event) => {
        if (active) scrollTop.current = event.currentTarget.scrollTop
      }}
    >
      <MediaActivityProvider active={active}>{children}</MediaActivityProvider>
    </TabsContent>
  )
}

// Only an accepted, visible destination consumes a request. Holding the same
// object also protects an open program's initial step and local form.
export function resolveRetainedDrawerRequest(
  retained: WorkspaceDataDrawerRequest | null,
  incoming: WorkspaceDataDrawerRequest | null | undefined,
  canApply: boolean
) {
  return canApply && incoming && incoming.id !== retained?.id
    ? incoming
    : retained
}

// Do not change Organization/Documents keys when another destination gets a link.
export function useRetainedDrawerRequest(
  tab: WorkspaceCanvasDrawerTab,
  request: WorkspaceDataDrawerRequest | null | undefined,
  active = true
) {
  const matching = request?.tab === tab ? request : null
  const [retained, setRetained] = useState(active ? matching : null)
  const next = resolveRetainedDrawerRequest(retained, matching, active)
  if (next !== retained) setRetained(next)
  return next
}
