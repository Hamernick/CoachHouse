"use client"

import { getParticleNotes, workspaceNoteDocuments } from "../lib/particle-notes"
import { useEffect, useId, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { ParticleEditorHeader, PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"
import XIcon from "lucide-react/dist/esm/icons/x"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { particleSchema } from "../lib/particle-schema"
import type { DecisionBranchReference } from "../lib/particle-decision"
import type { Particle, ParticleConnection } from "../types"
import { ParticleWidgetFields } from "./particle-widget-fields"
import { ParticleWorkFields } from "./particle-work-fields"
import { ParticleDecisionEditor } from "./particle-decision-editor"
import {
  ParticleCalendarEditor,
  type CalendarEntryRequest,
} from "./particle-calendar-editor"
import type { CalendarActivity } from "../lib/particle-calendar"
import { getParticleDocument, particleFileEditingSource } from "../lib/particle-file"
import { getParticleImage } from "../lib/particle-image"
import styles from "./particle-editor.module.css"

const NotesEditor = dynamic(() => import("./notes-editor").then((module) => module.NotesEditor), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading notes editor" className="flex min-h-80 flex-col gap-3 p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-64 w-full" /></div>,
})

const DocumentFileWindow = dynamic(() => import("@/features/document-editing/client").then(module => module.DocumentFileWindow), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading document" className="flex min-h-80 flex-col gap-3 p-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>,
})

export function ParticleInspector(props: Parameters<typeof ParticleMetadataInspector>[0]) {
  const note = getParticleNotes(props.particle)
  if (note) {
    const initialNote = note.kind === "workspace" ? workspaceNoteDocuments([props.particle])[0] : {
      id: `note:${note.moduleId}`, title: props.particle.title, summary: "", updatedAt: props.particle.updatedAt,
      source: { kind: "module_note" as const, moduleId: note.moduleId },
    }
    return <NotesEditor initialNote={initialNote} organizationId={props.particle.workspaceId} editable={props.editable} onClose={props.onClose} onDirtyChange={props.onDirtyChange} />
  }
  const source = particleFileEditingSource(props.particle)
  if (source) return <DocumentFileWindow key={`${source.organizationId}:${source.fileId}`} source={source} label={props.particle.title} onClose={props.onClose} />
  return <ParticleMetadataInspector {...props} />
}

function ParticleMetadataInspector({
  particle,
  editable,
  pending,
  onSave,
  onClose,
  onDirtyChange,
  calendarEntryRequest,
  activities,
  connections = [],
  decisionLinks = [],
}: {
  particle: Particle
  calendarEntryRequest?: CalendarEntryRequest
  activities?: readonly CalendarActivity[]
  connections?: readonly ParticleConnection[]
  decisionLinks?: readonly DecisionBranchReference[]
  editable: boolean
  pending: boolean
  onSave: (particle: Particle) => Promise<boolean>
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(particle)
  const [baseline, setBaseline] = useState(particle)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const isImage = Boolean(
    getParticleImage(particle) || getParticleDocument(particle)
  )
  const isNotes = particle.type === "activity" && particle.data.widget?.kind === "notes"
  const [saveFailed, setSaveFailed] = useState(false)
  const saveInFlight = useRef(false)
  const id = useId()
  const region = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!calendarEntryRequest) region.current?.focus({ preventScroll: true })
  }, [calendarEntryRequest])
  const dirty =
    imageUploading || JSON.stringify(draft) !== JSON.stringify(baseline)
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
  useWorkspaceEditorStatus({
    label: particle.title,
    dirty,
    pending: imageUploading || saving || (dirty && pending),
    error: stale || (dirty && saveFailed),
  })
  return (
    <section
      ref={region}
      tabIndex={-1}
      aria-label={`${particle.title} inspector`}
      className={cn("nodrag nopan nowheel focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset", styles.editor)}
    >
      <ParticleEditorHeader title={particle.title} actions={<>
            <Button
              variant="ghost"
              size="icon"
              className={PARTICLE_EDITOR_HEADER_ACTION}
              aria-label="Copy Particle"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    JSON.stringify(draft, null, 2)
                  )
                  setMessage({ text: "Copied" })
                } catch {
                  setMessage({ text: "Copy failed. Try again.", error: true })
                }
              }}
            >
              <CopyIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={PARTICLE_EDITOR_HEADER_ACTION}
              aria-label="Close inspector"
              onClick={onClose}
            >
              <XIcon aria-hidden />
            </Button>
      </>} />
      {stale ? (
        <div role="status" className="px-4 py-3 text-sm">
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
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            !editable ||
            pending ||
            imageUploading ||
            saveInFlight.current ||
            stale
          )
            return
          const parsed = particleSchema.safeParse(draft)
          if (!parsed.success) {
            const issue = parsed.error.issues[0]
            const entryIndex = issue?.path[2]
            const entry =
              draft.type === "calendar" &&
              issue?.path[1] === "entries" &&
              typeof entryIndex === "number"
                ? draft.data.entries[entryIndex]
                : null
            setMessage({
              text: `${entry ? `${entry.title || "Untitled entry"}: ` : ""}${issue?.message ?? "Check your details."}`,
              error: true,
            })
            return
          }
          saveInFlight.current = true
          setSaving(true)
          setSaveFailed(false)
          try {
            if (await onSave(parsed.data)) {
              setBaseline(parsed.data)
              setDraft((current) =>
                JSON.stringify(current) === JSON.stringify(draft)
                  ? parsed.data
                  : current
              )
              setMessage({ text: "Changes saved" })
            } else {
              setSaveFailed(true)
              setMessage({ text: "Changes could not be saved. Your draft is still here.", error: true })
            }
          } catch {
            setSaveFailed(true)
            setMessage({ text: "Changes could not be saved. Your draft is still here.", error: true })
          } finally {
            saveInFlight.current = false
            setSaving(false)
          }
        }}
      >
        <fieldset
          disabled={pending || saving || imageUploading}
          className="contents"
        >
          <FieldGroup className={styles.fields}>
            {!isNotes && (
              <FieldGroup className={styles.identity}>
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
                {!isImage && (
                  <Field className={styles.description}>
                    <FieldLabel htmlFor={`${id}-description`}>
                      Description
                    </FieldLabel>
                    <Textarea
                      id={`${id}-description`}
                      name="description"
                      className="min-h-36"
                      placeholder="Add context, details, or a brief…"
                      value={draft.description ?? ""}
                      disabled={!editable}
                      maxLength={10000}
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                      }
                    />
                  </Field>
                )}
              </FieldGroup>
            )}
            <FieldGroup className={styles.details}>
              <ParticleWidgetFields
                particle={draft}
                disabled={!editable}
                onChange={setDraft}
                onImagePendingChange={setImageUploading}
              />
              {!isImage && (
                <ParticleWorkFields
                  draft={draft}
                  editable={editable}
                  setDraft={setDraft}
                />
              )}
              {draft.type === "decision" ? (
                <ParticleDecisionEditor
                  particle={draft}
                  connections={[...connections,...decisionLinks]}
                  disabled={!editable}
                  onChange={setDraft}
                />
              ) : null}
              {draft.type === "calendar" ? (
                <ParticleCalendarEditor
                  particle={draft}
                  disabled={!editable}
                  onChange={setDraft}
                  activities={activities}
                  entryRequest={calendarEntryRequest}
                />
              ) : null}
            </FieldGroup>
          </FieldGroup>
          <Separator />
          <div className={styles.footer}>
            <p role="status" className={cn(styles.feedback, message?.error ? "text-destructive" : "text-muted-foreground")}>{message?.text}</p>
            <Button
              type="submit"
              disabled={!editable || pending || !dirty || stale}
              className={styles.submit}
              aria-busy={pending || saving}
            >
              {pending || saving ? <LoaderIcon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              Save changes
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
