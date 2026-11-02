"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useParticleProgressClock } from "../hooks/use-particle-progress-clock"
import { summarizeObjectiveProgress } from "../lib/particle-progress"
import { useEffect, useRef } from "react"
import XIcon from "lucide-react/dist/esm/icons/x"

import type { Particle } from "../types"
import { ParticleCard } from "./particle-card"
import { ParticleEditorHeader, PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"

const readOnly = () => {}

/** Personal inspection inside the existing content window; never a source writer. */
export function ParticleFocusedPreview({ particle, particles, editable, onOpen, onClose }: {
  particle: Particle
  particles?: readonly Particle[]
  editable: boolean
  onOpen: (calendarEntryId?: string) => void
  onClose: () => void
}) {
  const now = useParticleProgressClock(particle.type === "objective" && ["time", "both"].includes(particle.data.progress?.mode ?? ""))
  const objectiveProgress = particle.type === "objective" && !particle.data.source && particles ? summarizeObjectiveProgress(particle, particles, now) : undefined
  const region = useRef<HTMLElement>(null)
  useEffect(() => { region.current?.focus({ preventScroll: true }) }, [particle.id])
  return <section ref={region} tabIndex={-1} aria-label={`${particle.title} preview`}
    className="nodrag nopan nowheel min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
    <ParticleEditorHeader title={particle.title} actions={<>
      <Button color="secondary" type="button" variant="ghost" size="md" onClick={() => onOpen()}>{editable ? "Edit" : "View details"}</Button>
      <Button color="secondary" uniform type="button" variant="ghost" size="lg" className={PARTICLE_EDITOR_HEADER_ACTION} aria-label="Close preview" onClick={onClose}><XIcon aria-hidden /></Button>
    </>} />
    <div className="min-w-0 p-3">
      <ParticleCard controls={false}
        data={{ particle, objectiveProgress, expanded: true, editable: false, onEdit: readOnly, onOpen: (_id, options) => onOpen(options?.calendarEntryId) }} />
    </div>
  </section>
}
