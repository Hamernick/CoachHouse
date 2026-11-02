"use client"

import { ParticleInput as Input } from "@/components/ui/particle-ui"

import { useId } from "react"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ParticleSelect } from "@/components/ui/particle-ui"
import { DEFAULT_PROGRESS, type ParticleProgressConfig } from "../lib/particle-progress"
import type { Particle } from "../types"

function localDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
export function ParticleProgressFields({ particle, disabled, onChange }: {
  particle: Extract<Particle, { type: "objective" }>; disabled: boolean; onChange: (value: Particle) => void
}) {
  const id = useId()
  const value = particle.data.progress ?? DEFAULT_PROGRESS
  if (particle.data.source) return null
  const set = (next: Partial<ParticleProgressConfig>) => onChange({ ...particle, data: { ...particle.data, progress: { ...value, ...next } } })
  return <FieldGroup>
    <Field><FieldLabel htmlFor={`${id}-mode`}>Measure progress</FieldLabel>
      <ParticleSelect value={value.mode} disabled={disabled} onChange={event => { const mode = event.target.value;
        if (mode === "work" || mode === "time" || mode === "both" || mode === "ongoing") set({ mode })
       }} id={`${id}-mode`}>
<option value="" disabled>Choose…</option>
        <option value="work">Work</option><option value="time">Time</option>
        <option value="both">Work and time</option><option value="ongoing">Ongoing</option>
      </ParticleSelect>
    </Field>
    {(value.mode === "time" || value.mode === "both") && <div className="grid gap-3 sm:grid-cols-2">
      {(["startsAt", "endsAt"] as const).map(key => <Field key={key}><FieldLabel htmlFor={`${id}-${key}`}>{key === "startsAt" ? "Start" : "End"}</FieldLabel>
        <Input size="2xl" id={`${id}-${key}`} type="datetime-local" disabled={disabled} value={localDate(value[key])} onChange={event => {
          const raw = event.target.value
          if (!raw) set({ [key]: null })
          else if (Number.isFinite(new Date(raw).getTime())) set({ [key]: new Date(raw).toISOString() })
        }} /></Field>)}
    </div>}
    <p className="text-xs text-muted-foreground">{value.mode === "ongoing" ? "No overall percentage or finish date." : "Completing work or reaching the end date does not confirm the objective's outcome."}</p>
  </FieldGroup>
}
