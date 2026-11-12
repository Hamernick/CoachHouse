"use client"

import { ParticleBadge as Badge } from "@/components/ui/particle-ui"

import type { ReactNode } from "react"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"

import { WorkspaceNodeFrameHeader } from "@/components/workspace/workspace-node-frame"
import { WORKSPACE_PARTICLE_CHROME } from "@/components/workspace/workspace-particle-chrome"
import { useParticleSurface } from "./particle-surface"
import styles from "./particle-sizing.module.css"

export function ParticleFormHeader({ count, title = "Form", actions }: {
  count: number
  title?: string
  actions: ReactNode
}) {
  const surface = useParticleSurface()
  return (
    <WorkspaceNodeFrameHeader {...surface()} className="workspace-card-drag-handle cursor-grab flex-col gap-0 px-2.5 pt-0 pb-1 active:cursor-grabbing">
      <div className={styles.formHeader}>
        <span data-particle-header-icon="true" className="flex size-5 shrink-0 items-center justify-center" aria-hidden><ClipboardListIcon className="size-4" /></span>
        <h3 {...surface()} className={`${WORKSPACE_PARTICLE_CHROME.title} min-w-0 flex-1`} title={title}>{title}</h3>
        <div className={styles.formActions}>{actions}</div>
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <span {...surface()} className="text-muted-foreground text-xs tabular-nums">{count} {count === 1 ? "question" : "questions"}</span>
        <Badge color="secondary" {...surface()} variant="soft" className="rounded-full font-normal">Private draft</Badge>
      </div>
    </WorkspaceNodeFrameHeader>
  )
}
