"use client"

import type { ReactNode } from "react"
import CircleIcon from "lucide-react/dist/esm/icons/circle"
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check"
import CircleDashedIcon from "lucide-react/dist/esm/icons/circle-dashed"
import BanIcon from "lucide-react/dist/esm/icons/ban"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameHeader,
  WorkspaceNodeFrameBody,
  WorkspaceNodeFrameFooter,
} from "@/components/workspace/workspace-node-frame"
import { cn } from "@/lib/utils"
import type { ParticleStatus as Status } from "../types"

export const PARTICLE_STATUSES = {
  backlog: { label: "Backlog", icon: CircleDashedIcon },
  in_progress: { label: "In progress", icon: CircleIcon },
  done: { label: "Done", icon: CircleCheckIcon },
  blocked: { label: "Blocked", icon: BanIcon },
} as const

export function ParticleStatus({ status }: { status: Status }) {
  const { label, icon: Icon } = PARTICLE_STATUSES[status]
  return (
    <Badge
      variant="secondary"
      className="shrink-0 gap-1 text-[10px] font-normal"
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  )
}

export function ParticleFrame({
  children,
  selected,
}: {
  children?: ReactNode
  selected: boolean
}) {
  return (
    <WorkspaceNodeFrameRoot
      className={cn(
        "group/particle text-card-foreground flex flex-col gap-3 rounded-[28px] p-4 shadow-none",
        selected && "ring-ring ring-2"
      )}
      data-particle-frame="true"
    >
      {children}
    </WorkspaceNodeFrameRoot>
  )
}

export function ParticleHeader({
  title,
  label,
  status,
  icon,
}: {
  title: string
  label: string
  status: Status
  icon: ReactNode
}) {
  return (
    <WorkspaceNodeFrameHeader className="workspace-card-drag-handle cursor-grab active:cursor-grabbing">
      <span
        className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm leading-5 font-semibold">
          {title}
        </h3>
        <p className="text-muted-foreground text-[11px]">{label}</p>
      </div>
      <ParticleStatus status={status} />
    </WorkspaceNodeFrameHeader>
  )
}

export function ParticleBody({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNodeFrameBody className="bg-muted/40 rounded-2xl p-3">
      {children}
    </WorkspaceNodeFrameBody>
  )
}

export function ParticleFooter({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNodeFrameFooter className="justify-between gap-2 text-xs">
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
  const bounded = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs tabular-nums">{label}</p>
      <Progress
        value={bounded}
        aria-label={label}
        aria-valuenow={bounded}
        className="h-1.5 [&_[data-slot=progress-indicator]]:transition-transform [&_[data-slot=progress-indicator]]:duration-150 motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
      />
    </div>
  )
}
