"use client"

import { Check, Minus } from "lucide-react"
import { CircularProgress } from "@/components/ui/circular-progress"
import type { Particle } from "@/features/workspace-particles/client"

function statusOf(particle: Particle) {
  if (particle.status === "done") return { label: "Done", progress: null }
  if (particle.status === "blocked") return { label: "Blocked", progress: null }
  if (particle.type === "objective" && particle.data.current !== null && particle.data.target !== null && particle.data.target > 0) {
    const progress = Math.round(Math.max(0, Math.min(100, particle.data.current / particle.data.target * 100)))
    return { label: `${progress}%`, progress }
  }
  return { label: particle.status === "in_progress" ? "In progress" : "Not started", progress: null }
}

export function ParticleStatusMark({ particle }: { particle: Particle }) {
  const { progress } = statusOf(particle)
  if (particle.status === "done" || particle.status === "blocked") {
    const Icon = particle.status === "done" ? Check : Minus
    return <span aria-hidden="true" className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-full ${particle.status === "done" ? "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950" : "bg-destructive text-destructive-foreground"}`}><Icon className="size-3" strokeWidth={3} /></span>
  }
  if (progress !== null) return <CircularProgress decorative value={progress} size={18} strokeWidth={2} className="shrink-0" progressClassName="stroke-orange-600 dark:stroke-orange-400" />
  return <span aria-hidden="true" className={`inline-flex size-[18px] shrink-0 rounded-full border-2 ${particle.status === "in_progress" ? "border-orange-600 border-t-orange-600/25 dark:border-orange-400 dark:border-t-orange-400/25" : "border-dashed border-muted-foreground/45"}`} />
}

export function ParticleStatusLabel({ particle }: { particle: Particle }) {
  return <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-right text-xs font-normal tabular-nums text-muted-foreground">{statusOf(particle).label}</span>
}
