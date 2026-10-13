"use client"

import { useEffect, useId, useRef, useState } from "react"
import XIcon from "lucide-react/dist/esm/icons/x"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldMessage,
} from "@/components/ui/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select"
import { particleSchema, particleStatusSchema } from "../lib/particle-schema"
import { particleRegistry } from "../lib/particle-registry"
import type { Particle } from "../types"
import { replaceParticleSteps } from "../lib/particle-editing"
import { PARTICLE_STATUSES } from "./particle-frame"

export function ParticleInspector({
  particle,
  editable,
  pending,
  onSave,
  onClose,
  onDirtyChange,
}: {
  particle: Particle
  editable: boolean
  pending: boolean
  onSave: (particle: Particle) => Promise<boolean>
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(particle)
  const [baseline, setBaseline] = useState(particle)
  const [message, setMessage] = useState<string | null>(null)
  const id = useId()
  const region = useRef<HTMLElement>(null)
  useEffect(() => {
    region.current?.focus({ preventScroll: true })
  }, [])
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    if (dirty) return
    setDraft(particle)
    setBaseline(particle)
  }, [particle, dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const stale = particle.revision !== baseline.revision && dirty
  return (
    <section
      ref={region}
      tabIndex={-1}
      aria-label={`${particle.title} inspector`}
      className="nodrag nopan nowheel focus-visible:ring-ring flex min-h-0 flex-col gap-4 p-4 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">
            {particleRegistry[particle.type].label}
          </p>
          <h2 className="text-base font-semibold">{particle.title}</h2>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 transition-none md:size-8"
            aria-label="Copy Particle"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(draft, null, 2)
                )
                setMessage("Copied")
              } catch {
                setMessage("Copy failed. Try again.")
              }
            }}
          >
            <CopyIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 transition-none md:size-8"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      </div>
      {stale ? (
        <div role="status" className="text-sm">
          This Particle changed. Copy your draft or load the latest details.
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(particle)
              setBaseline(particle)
            }}
          >
            Load latest
          </Button>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const parsed = particleSchema.safeParse(draft)
          if (!parsed.success) {
            setMessage(parsed.error.issues[0]?.message ?? "Check your details.")
            return
          }
          if (await onSave(parsed.data)) {
            setBaseline(parsed.data)
            setDraft(parsed.data)
            setMessage("Saved")
          }
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
            <Input
              id={`${id}-title`}
              name="title"
              value={draft.title}
              disabled={!editable}
              maxLength={240}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea
              id={`${id}-description`}
              name="description"
              value={draft.description ?? ""}
              disabled={!editable}
              maxLength={10000}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
            <Select
              value={draft.status}
              disabled={!editable}
              onValueChange={(value) => {
                const status = particleStatusSchema.safeParse(value)
                if (status.success) setDraft({ ...draft, status: status.data })
              }}
            >
              <SelectTrigger id={`${id}-status`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(PARTICLE_STATUSES).map(([value, item]) => (
                    <SelectItem key={value} value={value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {draft.type === "objective" ? (
            <div className="grid grid-cols-2 gap-3">
              {(["current", "target"] as const).map((field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`${id}-${field}`}>
                    {field === "current" ? "Current" : "Target"}
                  </FieldLabel>
                  <Input
                    id={`${id}-${field}`}
                    type="number"
                    min={0}
                    step="any"
                    disabled={!editable}
                    value={draft.data[field] ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        data: {
                          ...draft.data,
                          [field]:
                            event.target.value === ""
                              ? null
                              : event.target.valueAsNumber,
                        },
                      })
                    }
                  />
                </Field>
              ))}
              <Field className="col-span-2">
                <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
                <Input
                  id={`${id}-unit`}
                  value={draft.data.unit}
                  disabled={!editable}
                  maxLength={80}
                  placeholder="e.g. attendees…"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      data: { ...draft.data, unit: event.target.value },
                    })
                  }
                />
              </Field>
            </div>
          ) : null}
          {draft.type === "activity" || draft.type === "workflow" ? (
            <FieldGroup>
              <FieldLabel>Checklist</FieldLabel>
              {draft.data.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <Input
                    aria-label={`Step ${index + 1}`}
                    value={step.title}
                    disabled={!editable}
                    maxLength={240}
                    onChange={(event) =>
                      setDraft(
                        replaceParticleSteps(
                          draft,
                          draft.data.steps.map((item) =>
                            item.id === step.id
                              ? { ...item, title: event.target.value }
                              : item
                          )
                        )
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!editable}
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() =>
                      setDraft(
                        replaceParticleSteps(
                          draft,
                          draft.data.steps.filter((item) => item.id !== step.id)
                        )
                      )
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!editable || draft.data.steps.length >= 200}
                onClick={() =>
                  setDraft(
                    replaceParticleSteps(draft, [
                      ...draft.data.steps,
                      {
                        id: crypto.randomUUID(),
                        title: "New step",
                        status: "backlog",
                        order: draft.data.steps.length,
                      },
                    ])
                  )
                }
              >
                <PlusIcon aria-hidden />
                Add step
              </Button>
            </FieldGroup>
          ) : null}
        </FieldGroup>
        <div className="flex items-center justify-between gap-3">
          <FieldMessage aria-live="polite">{message}</FieldMessage>
          <Button
            type="submit"
            disabled={!editable || pending || !dirty || stale}
            className="min-h-11 transition-none md:min-h-9"
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  )
}
