"use client"

import CalendarIcon from "lucide-react/dist/esm/icons/calendar-days"
import ClockIcon from "lucide-react/dist/esm/icons/clock-3"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useId } from "react"

export function ParticleEventDateControl({ type, value, onChange, disabled }: {
  type: "date" | "time"; value: string; onChange: (value: string) => void; disabled: boolean
}) {
  const id = useId()
  const Icon = type === "date" ? CalendarIcon : ClockIcon
  const label = type === "date" ? "Event date" : "Event time"
  const date = value ? new Date(type === "date" ? `${value}T12:00:00` : `2000-01-01T${value}`) : null
  const copy = date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, type === "date" ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" }).format(date)
    : `Add ${type}`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" disabled={disabled} aria-label={label}
          className="nodrag nopan h-7 rounded-full px-2.5 text-xs shadow-none [@media(pointer:coarse)]:min-h-11">
          <Icon data-icon="inline-start" aria-hidden /><span>{copy}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="nodrag nopan nowheel w-64 rounded-2xl p-3 shadow-none motion-reduce:animate-none">
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input id={id} type={type} value={value} disabled={disabled} onChange={event => onChange(event.currentTarget.value)}/>
          <FieldDescription>Uses your device’s time zone.</FieldDescription>
        </Field>
      </PopoverContent>
    </Popover>
  )
}
