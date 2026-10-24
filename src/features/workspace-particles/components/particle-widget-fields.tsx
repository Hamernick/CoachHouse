"use client"

import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import { useId } from "react"
import { Field, FieldLabel, FieldMessage } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ParticleModuleNotesEditor } from "./particle-module-notes-editor"
import type { Particle } from "../types"
import { ParticleImageFields } from "./particle-image-fields"
import { calculateParticleExpression } from "../lib/particle-calculation"

export function ParticleWidgetFields({
  particle,
  disabled,
  onChange,
  onImagePendingChange,
}: {
  particle: Particle
  disabled: boolean
  onChange: (particle: Particle) => void
  onImagePendingChange?: (pending: boolean) => void
}) {
  const id = useId()
  if (particle.type !== "activity" || !particle.data.widget) return null
  const widget = particle.data.widget
  if (widget.kind === "opportunity") return <p className="text-sm text-muted-foreground">Edit this report in Opportunities. Changes appear here automatically.</p>
  if (widget.kind === "form")
    return <OrganizationFormBuilder definition={widget.definition} disabled={disabled} onChange={definition => onChange({ ...particle, data: { ...particle.data, widget: { ...widget, definition } } })}/>
  if (widget.kind === "notes") {
    if (widget.source.kind === "module")
      return (
        <ParticleModuleNotesEditor
          key={widget.source.moduleId}
          moduleId={widget.source.moduleId}
          readOnly={disabled}
        />
      )
    return (
      <Field>
        <FieldLabel htmlFor={id}>Notes</FieldLabel>
        <Textarea
          id={id}
          value={widget.source.content}
          disabled={disabled}
          maxLength={20_000}
          className="min-h-60 resize-y"
          onChange={(event) =>
            onChange({
              ...particle,
              data: {
                ...particle.data,
                widget: {
                  ...widget,
                  source: { kind: "workspace", content: event.target.value },
                },
              },
            })
          }
        />
      </Field>
    )
  }
  if (widget.kind === "image_placeholder")
    return (
      <p className="text-muted-foreground text-xs">
        Drop an image into this card on the canvas.
      </p>
    )
  if (widget.kind === "document")
    return (
      <p className="text-muted-foreground text-xs">
        {widget.name} · Read-only preview. Upload a new file to replace its
        contents.
      </p>
    )
  if (widget.kind === "image")
    return (
      <ParticleImageFields
        particle={particle}
        disabled={disabled}
        onChange={onChange}
        onPendingChange={onImagePendingChange}
      />
    )
  const update = (next: typeof widget) =>
    onChange({ ...particle, data: { ...particle.data, widget: next } })
  if (widget.kind === "timer")
    return (
      <Field>
        <FieldLabel htmlFor={id}>Duration (seconds)</FieldLabel>
        <Input
          id={id}
          type="number"
          min={1}
          max={86400}
          disabled={disabled}
          value={widget.seconds}
          onChange={(event) =>
            update({
              ...widget,
              seconds: Number(event.target.value),
              remainingSeconds: undefined,
              endsAt: null,
            })
          }
        />
      </Field>
    )
  if (widget.kind === "split")
    return (
      <>
        <Field>
          <FieldLabel htmlFor={`${id}-total`}>Total</FieldLabel>
          <Input
            id={`${id}-total`}
            type="number"
            min={0}
            step="any"
            disabled={disabled}
            value={widget.total}
            onChange={(event) =>
              update({ ...widget, total: Number(event.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-people`}>People</FieldLabel>
          <Input
            id={`${id}-people`}
            type="number"
            min={1}
            max={10000}
            disabled={disabled}
            value={widget.people}
            onChange={(event) =>
              update({ ...widget, people: Number(event.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>Currency code</FieldLabel>
          <Input
            id={`${id}-currency`}
            maxLength={3}
            disabled={disabled}
            value={widget.currency}
            onChange={(event) =>
              update({ ...widget, currency: event.target.value.toUpperCase() })
            }
          />
        </Field>
      </>
    )
  if (widget.kind === "color")
    return (
      <Field>
        <FieldLabel htmlFor={id}>Hex color</FieldLabel>
        <Input
          id={id}
          disabled={disabled}
          value={widget.hex}
          onChange={(event) => update({ ...widget, hex: event.target.value })}
        />
      </Field>
    )
  if (widget.kind === "calculate") {
    let error: string | null = null
    try {
      calculateParticleExpression(widget.expression)
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "Check the expression."
    }
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={id}>Expression</FieldLabel>
        <Input
          id={id}
          disabled={disabled}
          value={widget.expression}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            let result = widget.result
            try {
              result = calculateParticleExpression(event.target.value)
            } catch {
              /* Keep the last valid result while typing; save validates the expression. */
            }
            update({ ...widget, expression: event.target.value, result })
          }}
        />
        {error && <FieldMessage>{error}</FieldMessage>}
      </Field>
    )
  }
  const local = widget.startsAt
    ? new Date(
        Date.parse(widget.startsAt) -
          new Date(widget.startsAt).getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16)
    : ""
  return (
    <Field>
      <FieldLabel htmlFor={id}>Starts at (your local time)</FieldLabel>
      <Input
        id={id}
        type="datetime-local"
        disabled={disabled}
        value={local}
        onChange={(event) => {
          const value = event.target.value
          if (value && !Number.isFinite(Date.parse(value))) return
          update({
            ...widget,
            startsAt: value ? new Date(value).toISOString() : null,
          })
        }}
      />
    </Field>
  )
}
