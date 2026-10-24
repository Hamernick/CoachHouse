"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldMessage } from "@/components/ui/field"
import {
  calendarLocalDateTime,
  calendarUtcDateTime,
} from "../lib/particle-calendar"

export function ParticleCalendarDateField({
  label,
  value,
  disabled,
  required,
  onChange,
}: {
  label: string
  value: string | null
  disabled: boolean
  required?: boolean
  onChange: (instant: string | null) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Client-local time only after hydration; server and client initially agree.
  useEffect(() => {
    setLocal(calendarLocalDateTime(value))
    setError(null)
    input.current?.setCustomValidity("")
  }, [value])
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label} (your local time)</FieldLabel>
      <Input
        ref={input}
        id={id}
        type="datetime-local"
        step={60}
        value={local}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const text = event.target.value
          setLocal(text)
          const instant = calendarUtcDateTime(text)
          const message =
            instant === undefined ? "Enter a valid local date and time." : ""
          event.target.setCustomValidity(message)
          setError(message || null)
          if (instant !== undefined) onChange(instant)
        }}
      />
      {error ? <FieldMessage id={`${id}-error`}>{error}</FieldMessage> : null}
    </Field>
  )
}
