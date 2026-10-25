"use client"

import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldMessage } from "@/components/ui/field"
import {
  getParticleImage,
  PARTICLE_IMAGE_ACCEPT,
  uploadParticleImage,
} from "../lib/particle-image"
import type { Particle } from "../types"

export function ParticleImageFields({
  particle,
  disabled,
  onChange,
  onPendingChange,
}: {
  particle: Particle
  disabled: boolean
  onChange: (particle: Particle) => void
  onPendingChange?: (pending: boolean) => void
}) {
  const id = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const image = getParticleImage(particle)
  if (!image || particle.type !== "activity") return null
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-alt`}>Image description</FieldLabel>
        <Input
          id={`${id}-alt`}
          placeholder="Describe the image for screen readers"
          maxLength={1000}
          value={image.alt}
          disabled={disabled || pending}
          onChange={(event) =>
            onChange({
              ...particle,
              data: {
                ...particle.data,
                widget: { ...image, alt: event.target.value },
              },
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-file`}>Replace image</FieldLabel>
        <Input
          id={`${id}-file`}
          type="file"
          accept={PARTICLE_IMAGE_ACCEPT}
          disabled={disabled || pending}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (!file) return
            setPending(true)
            onPendingChange?.(true)
            setError(null)
            try {
              const replacement = await uploadParticleImage(
                particle.workspaceId,
                file
              )
              onChange({
                ...particle,
                data: {
                  ...particle.data,
                  widget: { ...replacement, alt: image.alt },
                },
              })
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Unable to replace image."
              )
            } finally {
              setPending(false)
              onPendingChange?.(false)
            }
          }}
        />
        <FieldMessage aria-live="polite">
          {pending ? "Uploading…" : error}
        </FieldMessage>
      </Field>
    </>
  )
}
