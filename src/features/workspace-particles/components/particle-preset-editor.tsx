"use client"

import { OrganizationFormBuilder } from "@/features/organization-forms/client"
import type { FormDefinition } from "@/features/organization-forms"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"

import { motion, useReducedMotion } from "motion/react"
import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { ParticleCard } from "./particle-card"
import { ParticleEditorHeader, PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"
import { ParticleDraftBackButton } from "./particle-draft-back-button"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  type ParticlePreset,
} from "../lib/particle-presets"
import type { Particle } from "../types"
import { createParticle } from "../lib/particle-registry"
import { cn } from "@/lib/utils"
import styles from "./particle-editor.module.css"

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
  const initialTitle = preset.id === "form" ? "" : preset.label
  const [title, setTitle] = useState(initialTitle)
  const needsFormName = preset.id === "form" && !title.trim()
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState(DEFAULT_PRESET_FIELDS)
  const [form, setForm] = useState<FormDefinition>({ questions: [] })
  const [formPreview, setFormPreview] = useState(false)
  const [previewEdit, setPreviewEdit] = useState<{
    baseline: Particle
    particle: Particle
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const submitting = useRef(false)
  const titleInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    titleInput.current?.focus({ preventScroll: true })
  }, [])
  const id = useId()
  const dirty =
    previewEdit !== null ||
    form.questions.length > 0 ||
    title !== initialTitle ||
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
          title: preset.id === "form" && !title.trim() ? preset.label : title,
          description,
          fields,
          form,
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
  }, [preset, identity, workspaceId, title, description, fields, form])
  // Keep the same card and input tree mounted through temporarily invalid edits.
  const emptyPreview = useMemo(() => {
    const input = { ...identity, workspaceId, title: preset.label, description: "", fields: DEFAULT_PRESET_FIELDS }
    try {
      return buildParticlePreset(preset, input)
    } catch {
      return createParticle(preset.type, input)
    }
  }, [preset, identity, workspaceId])
  const previewParticle =
    previewEdit?.baseline === result.particle
      ? previewEdit.particle
      : result.particle ?? emptyPreview
  const submit = async (retry = false) => {
    if (submitting.current || (disabled && !retry) || pending) return
    if (needsFormName) {
      setMessage("Name this form before adding it.")
      return
    }
    if (!result.particle) {
      setMessage(result.error)
      return
    }
    if (previewParticle.type === "activity" && previewParticle.data.widget?.kind === "event" && !previewParticle.data.widget.startsAt) {
      setMessage("Choose a date and time to add this event to the calendar.")
      return
    }
    submitting.current = true
    setAdding(true)
    setMessage(null)
    try {
      if (await onAdd(previewParticle)) onBack()
      else setMessage("Not confirmed yet. Your draft is still here.")
    } catch {
      setMessage("Unable to add this Particle. Your draft is still here.")
    } finally {
      submitting.current = false
      setAdding(false)
    }
  }
  const busy = pending || adding
  useWorkspaceEditorStatus({
    label: title || preset.label,
    dirty,
    draft: true,
    pending: adding,
    error: Boolean(message),
  })
  const editorFields = (
    <FieldGroup id={`${id}-fields`} className={cn(styles.fields, styles.presetFields, preset.id === "form" && styles.formFields)}>
      {preset.id === "form" && formPreview ? (
        <div className="flex flex-col gap-2 py-3">
          <h3 className="text-lg font-semibold break-words">{title || "Untitled form"}</h3>
          {description && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{description}</p>}
        </div>
      ) : <>
      <Field>
        <FieldLabel className={preset.id === "form" ? undefined : "sr-only"} htmlFor={`${id}-title`}>{preset.id === "form" ? "Form name" : "Title"}</FieldLabel>
        <Input
          id={`${id}-title`}
          ref={titleInput}
          className={styles.titleInput}
          placeholder={preset.id === "form" ? "Name this form..." : "Name this Particle…"}
          required={preset.id === "form"}
          value={title}
          maxLength={240}
          disabled={disabled || busy || Boolean(error)}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Collapsible className={styles.optionalDetails}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className={styles.detailTrigger}>
            {description ? "Edit description" : "Add description"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className={styles.descriptionContent}>
          <Field className={styles.description}>
            <FieldLabel className="sr-only" htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea
              id={`${id}-description`}
              value={description}
              placeholder="Add context, details, or a brief…"
              maxLength={10000}
              disabled={disabled || busy || Boolean(error)}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </CollapsibleContent>
      </Collapsible>
      </>}
      {preset.fields.map((field) => (
        <Field key={field.key} className={field.input === "textarea" ? styles.longProperty : styles.property}>
          <FieldLabel htmlFor={`${id}-${field.key}`}>
            {field.label}
          </FieldLabel>
          {field.input === "textarea" ? (
            <Textarea
              id={`${id}-${field.key}`}
              value={fields[field.key]}
              maxLength={10000}
              disabled={disabled || busy || Boolean(error)}
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
              disabled={disabled || busy || Boolean(error)}
              onChange={(event) =>
                setFields({ ...fields, [field.key]: event.target.value })
              }
            />
          )}
        </Field>
      ))}
      {preset.id === "form" && <OrganizationFormBuilder preview={formPreview} onPreviewChange={setFormPreview} showPreviewControl={false} definition={form} disabled={disabled || busy || Boolean(error)} onChange={setForm}/>}
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
      {result.error && <p role="status" className="text-muted-foreground text-sm">{result.error}</p>}
    </FieldGroup>
  )
  return (
    <motion.form
      id={`${id}-form`}
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={
        reducedMotion ? { duration: 0 } : WORKSPACE_SURFACE_MOTION.enterOpacity
      }
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className={cn("nodrag nopan nowheel", styles.editor)}
      aria-label={`Configure ${preset.label}`}
      {...getReactGrabOwnerProps({
        ownerId: "workspace-particle:preset-editor",
        component: "ParticlePresetEditor",
        source:
          "src/features/workspace-particles/components/particle-preset-editor.tsx",
      })}
    >
      <ParticleEditorHeader title={preset.label} leading={
        <ParticleDraftBackButton dirty={dirty} pending={busy} onBack={onBack} />
      } actions={
        <Button
          type="submit"
          form={`${id}-form`}
          size="icon"
          className={PARTICLE_EDITOR_HEADER_ACTION}
          aria-label={busy ? "Adding to canvas" : "Add to canvas"}
          title="Add to canvas"
          disabled={disabled || busy || !result.particle || needsFormName}
        >
          {busy ? <LoaderCircleIcon className="motion-safe:animate-spin" aria-hidden /> : <PlusIcon aria-hidden />}
        </Button>
      } />
      <ScrollArea
        className={styles.presetSurface}
        contentClassName={styles.presetLayout}
        viewportClassName="overscroll-contain"
        aria-label={`${preset.label} configuration`}
      >
        <div className={styles.preview} aria-label={`${preset.label} editor`}>
          <ParticleCard
            editorFields={editorFields}
            headerAction={preset.id === "form" ? (
              <ToggleGroup type="single" value={formPreview ? "preview" : "edit"} onValueChange={value => { if (value) setFormPreview(value === "preview") }} aria-label="Form mode" className="nodrag nopan rounded-full bg-background/70 p-0.5" spacing={1}>
                <ToggleGroupItem value="edit" className={styles.formHeaderAction} aria-controls={`${id}-fields`}>Edit</ToggleGroupItem>
                <ToggleGroupItem value="preview" className={styles.formHeaderAction} aria-controls={`${id}-fields`}>Preview</ToggleGroupItem>
              </ToggleGroup>
            ) : undefined}
            controls={false}
            data={{
              particle: previewParticle,
              editable: !disabled && !busy && !error && Boolean(result.particle),
              onEdit: (particle) => {
                if (result.particle)
                  setPreviewEdit({ baseline: result.particle, particle })
              },
              onOpen: () => document.getElementById(`${id}-fields`)?.querySelector<HTMLElement>(preset.id === "form" ? 'section[aria-label="Form questions"] button' : "input,textarea")?.focus(),
            }}
          />
        </div>
      </ScrollArea>
      <div role="status" className={cn(styles.feedback, "text-muted-foreground px-4 pb-3")}>
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
