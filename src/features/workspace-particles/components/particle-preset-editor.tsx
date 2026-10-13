"use client"

import { motion, useReducedMotion } from "motion/react"
import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { ParticleCard } from "./particle-card"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  type ParticlePreset,
} from "../lib/particle-presets"
import type { Particle } from "../types"

export function ParticlePresetEditor({
  preset,
  workspaceId,
  disabled,
  pending,
  error,
  onRetry,
  onBack,
  onAdd,
}: {
  preset: ParticlePreset
  workspaceId: string
  disabled: boolean
  pending: boolean
  error: string | null
  onRetry: () => void
  onBack: () => void
  onAdd: (particle: Particle) => Promise<boolean>
}) {
  const reducedMotion = useReducedMotion()
  const [identity] = useState(() => ({
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
  }))
  const [title, setTitle] = useState(preset.label)
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState(DEFAULT_PRESET_FIELDS)
  const [message, setMessage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const submitting = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    titleInput.current?.focus({ preventScroll: true })
  }, [])
  const id = useId()
  const dirty =
    title !== preset.label ||
    Boolean(description) ||
    JSON.stringify(fields) !== JSON.stringify(DEFAULT_PRESET_FIELDS)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const result = useMemo(() => {
    try {
      return {
        particle: buildParticlePreset(preset, {
          ...identity,
          workspaceId,
          title,
          description,
          fields,
        }),
        error: null,
      }
    } catch (error) {
      return {
        particle: null,
        error:
          error instanceof Error && !error.message.startsWith("[")
            ? error.message
            : "Check the required fields and values.",
      }
    }
  }, [preset, identity, workspaceId, title, description, fields])
  const submit = async (retry = false) => {
    if (submitting.current || (disabled && !retry) || pending) return
    if (!result.particle) {
      setMessage(result.error)
      return
    }
    submitting.current = true
    setAdding(true)
    setMessage(null)
    try {
      if (await onAdd(result.particle)) onBack()
      else setMessage("Not confirmed yet. Your draft is still here.")
    } catch {
      setMessage("Unable to add this Particle. Your draft is still here.")
    } finally {
      submitting.current = false
      setAdding(false)
    }
  }
  const busy = pending || adding
  return (
    <motion.form
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={
        reducedMotion ? { duration: 0 } : WORKSPACE_SURFACE_MOTION.enterOpacity
      }
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="nodrag nopan nowheel flex flex-col gap-5 p-4"
      aria-label={`Configure ${preset.label}`}
      {...getReactGrabOwnerProps({
        ownerId: "workspace-particle:preset-editor",
        component: "ParticlePresetEditor",
        source:
          "src/features/workspace-particles/components/particle-preset-editor.tsx",
      })}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-full"
          aria-label="Back to Particles"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard this Particle draft?"))
              onBack()
          }}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium">{preset.label}</h2>
          <p className="text-muted-foreground text-xs">Preview before adding</p>
        </div>
        <Button
          type="submit"
          size="icon"
          className="size-11 rounded-full shadow-none"
          aria-label={busy ? "Adding to canvas" : "Add to canvas"}
          title="Add to canvas"
          disabled={disabled || busy || !result.particle}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
            <Input
              id={`${id}-title`}
              ref={titleInput}
              value={title}
              maxLength={240}
              disabled={busy || Boolean(error)}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea
              id={`${id}-description`}
              value={description}
              maxLength={10000}
              disabled={busy || Boolean(error)}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {preset.fields.map((field) => (
            <Field key={field.key}>
              <FieldLabel htmlFor={`${id}-${field.key}`}>
                {field.label}
              </FieldLabel>
              {field.input === "textarea" ? (
                <Textarea
                  id={`${id}-${field.key}`}
                  value={fields[field.key]}
                  maxLength={10000}
                  disabled={busy || Boolean(error)}
                  onChange={(event) =>
                    setFields({ ...fields, [field.key]: event.target.value })
                  }
                />
              ) : (
                <Input
                  id={`${id}-${field.key}`}
                  type={field.input ?? "text"}
                  step="any"
                  value={fields[field.key]}
                  maxLength={240}
                  disabled={busy || Boolean(error)}
                  onChange={(event) =>
                    setFields({ ...fields, [field.key]: event.target.value })
                  }
                />
              )}
            </Field>
          ))}
          {preset.id === "message" && (
            <p className="text-muted-foreground text-xs">
              Saved as an email draft. Nothing will be sent.
            </p>
          )}
          {preset.id === "poll" && (
            <p className="text-muted-foreground text-xs">
              Record a decision here. Public voting is not connected.
            </p>
          )}
        </FieldGroup>
        {result.particle ? (
          <div inert className="pointer-events-none">
            <ParticleCard
              controls={false}
              data={{
                particle: result.particle,
                editable: false,
                onEdit: () => {},
                onOpen: () => {},
              }}
            />
          </div>
        ) : (
          <p className="text-muted-foreground rounded-2xl border border-dashed p-5 text-sm">
            {result.error}
          </p>
        )}
      </div>
      <div role="status" className="text-muted-foreground text-sm">
        {error ?? message}
        {error && (
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={() => {
              if (result.particle) void submit(true)
              else onRetry()
            }}
          >
            Retry save
          </Button>
        )}
      </div>
    </motion.form>
  )
}
