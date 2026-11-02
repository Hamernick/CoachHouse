"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
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
      <Select value={value.mode} disabled={disabled} onValueChange={mode => {
        if (mode === "work" || mode === "time" || mode === "both" || mode === "ongoing") set({ mode })
      }}><SelectTrigger id={`${id}-mode`}><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="work">Work</SelectItem><SelectItem value="time">Time</SelectItem>
        <SelectItem value="both">Work and time</SelectItem><SelectItem value="ongoing">Ongoing</SelectItem>
      </SelectContent></Select>
    </Field>
    {(value.mode === "time" || value.mode === "both") && <div className="grid gap-3 sm:grid-cols-2">
      {(["startsAt", "endsAt"] as const).map(key => <Field key={key}><FieldLabel htmlFor={`${id}-${key}`}>{key === "startsAt" ? "Start" : "End"}</FieldLabel>
        <Input id={`${id}-${key}`} type="datetime-local" disabled={disabled} value={localDate(value[key])} onChange={event => {
          const raw = event.target.value
          if (!raw) set({ [key]: null })
          else if (Number.isFinite(new Date(raw).getTime())) set({ [key]: new Date(raw).toISOString() })
        }} /></Field>)}
    </div>}
    <p className="text-xs text-muted-foreground">{value.mode === "ongoing" ? "No overall percentage or finish date." : "Completing work or reaching the end date does not confirm the objective's outcome."}</p>
  </FieldGroup>
}
