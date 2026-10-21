"use client"

import type { ReactNode } from "react"
import {
  useWorkspaceWindowHeader,
  WorkspaceWindowHeaderPortal,
} from "@/components/workspace/workspace-window-header-slots"

export const PARTICLE_EDITOR_HEADER_ACTION =
  "size-7 rounded-full shrink-0 shadow-none transition-none [@media(pointer:coarse)]:size-11"

/** One editor header: window slots when hosted, inline only when standalone. */
export function ParticleEditorHeader({
  title,
  leading,
  actions,
}: {
  title: string
  leading?: ReactNode
  actions: ReactNode
}) {
  const inWindow = useWorkspaceWindowHeader()
  return (
    <div
      className={
        inWindow
          ? "contents"
          : "flex min-w-0 items-center justify-between gap-2 px-4 py-2"
      }
    >
      <WorkspaceWindowHeaderPortal slot="title">
        <div className="nodrag nopan flex min-w-0 items-center gap-1">
          {leading}
          <h2 className="min-w-0 truncate text-sm font-medium" title={title}>
            {title}
          </h2>
        </div>
      </WorkspaceWindowHeaderPortal>
      <WorkspaceWindowHeaderPortal>
        <div className="nodrag nopan flex shrink-0 items-center gap-1">
          {actions}
        </div>
      </WorkspaceWindowHeaderPortal>
    </div>
  )
}
