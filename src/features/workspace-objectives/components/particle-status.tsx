"use client"

import { Check, Minus } from "lucide-react"
import { CircularProgress } from "@/components/ui/circular-progress"
import { useParticleProgressClock, summarizeObjectiveProgress } from "@/features/workspace-particles/client"
import type { Particle } from "@/features/workspace-particles/client"

function statusOf(particle: Particle, particles?: readonly Particle[], now = Number.NaN) {
  if (particle.type === "objective" && !particle.data.source && particles) {
    const summary = summarizeObjectiveProgress(particle, particles, now)
    return { label: summary.label, progress: summary.percent }
  }
  if (particle.status === "done") return { label: "Done", progress: null }
  if (particle.status === "blocked") return { label: "Blocked", progress: null }
  if (particle.type === "objective" && particle.data.current !== null && particle.data.target !== null && particle.data.target > 0) {
    const progress = Math.round(Math.max(0, Math.min(100, particle.data.current / particle.data.target * 100)))
    return { label: `${progress}%`, progress }
  }
  return { label: particle.status === "in_progress" ? "In progress" : "Not started", progress: null }
}

export function ParticleStatusMark({ particle, particles }: { particle: Particle; particles?: readonly Particle[] }) {
  const now = useParticleProgressClock(particle.type === "objective" && ["time", "both"].includes(particle.data.progress?.mode ?? ""))
  const { progress } = statusOf(particle, particles, now)
  if (particle.status === "done" || particle.status === "blocked") {
    const Icon = particle.status === "done" ? Check : Minus
    return <span aria-hidden="true" className={`flex size-[18px] shrink-0 items-center justify-center rounded-full ${particle.status === "done" ? "bg-emerald-600 text-white dark:bg-emerald-500" : "bg-destructive text-destructive-foreground"}`}><Icon className="size-3" strokeWidth={3} /></span>
  }
  if (progress !== null) return <CircularProgress decorative value={progress} size={18} strokeWidth={2} className="shrink-0" trackClassName="stroke-muted-foreground/30 dark:stroke-muted-foreground/30" progressClassName="stroke-emerald-500" />
  return <span aria-hidden="true" className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 ${particle.status === "in_progress" ? "border-r-emerald-500" : ""}`} />
}

export function ParticleStatusLabel({ particle, particles, visuallyHidden = false }: { particle: Particle; particles?: readonly Particle[]; visuallyHidden?: boolean }) {
  const now = useParticleProgressClock(particle.type === "objective" && ["time", "both"].includes(particle.data.progress?.mode ?? ""))
  return <span className={visuallyHidden ? "sr-only" : "ml-auto shrink-0 whitespace-nowrap pl-2 text-right text-xs font-normal tabular-nums text-muted-foreground"}>{statusOf(particle, particles, now).label}</span>
}
