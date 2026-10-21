"use client"

import { useParticleSurface } from "./particle-surface"
import type { ReactNode, ComponentProps } from "react"
import { Progress } from "@/components/ui/progress"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameHeader,
  WorkspaceNodeFrameBody,
  WorkspaceNodeFrameFooter,
} from "@/components/workspace/workspace-node-frame"
import styles from "./particle-sizing.module.css"
import { WORKSPACE_PARTICLE_CHROME } from "@/components/workspace/workspace-particle-chrome"
import { cn } from "@/lib/utils"

export function ParticleFrame({
  children,
  selected,
  className,
  onKeyDown,
}: {
  children?: ReactNode
  selected: boolean
  className?: string
  onKeyDown?: ComponentProps<"article">["onKeyDown"]
}) {
  const surface = useParticleSurface()
  return (
    <WorkspaceNodeFrameRoot
      {...surface()}

      className={cn(
        "group/particle text-card-foreground",
        WORKSPACE_PARTICLE_CHROME.root,
        styles.frame,
        selected && "ring-ring ring-2",
        className
      )}
      data-particle-frame="true"
      onKeyDown={onKeyDown}
    >
      {children}
    </WorkspaceNodeFrameRoot>
  )
}

export function ParticleHeader({
  title,
  icon,
  action,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
}) {
  const surface = useParticleSurface()
  return (
    <WorkspaceNodeFrameHeader
      {...surface()}
      className={cn(
        WORKSPACE_PARTICLE_CHROME.header,
        "workspace-card-drag-handle cursor-grab active:cursor-grabbing"
      )}
    >
      <span
        {...surface()}
        className="flex size-5 shrink-0 items-center justify-center"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3
          {...surface()}
          className={WORKSPACE_PARTICLE_CHROME.title}
          title={title}
        >
          {title}
        </h3>
      </div>
      {action && (
        <div className="flex shrink-0 items-center justify-center">
          {action}
        </div>
      )}
    </WorkspaceNodeFrameHeader>
  )
}

export function ParticleBody({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNodeFrameBody
      className={cn("nowheel", WORKSPACE_PARTICLE_CHROME.body, styles.body)}
    >
      {children}
    </WorkspaceNodeFrameBody>
  )
}

export function ParticleFooter({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNodeFrameFooter className={WORKSPACE_PARTICLE_CHROME.footer}>
      {children}
    </WorkspaceNodeFrameFooter>
  )
}

export function ParticleProgress({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const surface = useParticleSurface()
  const bounded = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col gap-2">
      <p
        {...surface()}
        className="text-muted-foreground text-xs tabular-nums"
      >
        {label}
      </p>
      <Progress
        {...surface()}
        value={bounded}
        aria-label={label}
        aria-valuenow={bounded}
        className="h-1.5 [&_[data-slot=progress-indicator]]:transition-transform [&_[data-slot=progress-indicator]]:duration-150 motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
      />
    </div>
  )
}
