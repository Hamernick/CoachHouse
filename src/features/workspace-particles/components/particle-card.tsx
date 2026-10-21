"use client"

import type { ComponentProps, ReactNode } from "react"
import { particleIcon } from "./particle-preset-icons"
import { ParticleActionMenu } from "./particle-action-menu"
import { ParticleDocumentCard } from "./particle-document-card"
import { getParticleDocument } from "../lib/particle-file"
import { ParticleImageCard } from "./particle-image-card"
import { ParticleImagePlaceholder } from "./particle-image-placeholder"
import { getParticleImage, isImagePlaceholder } from "../lib/particle-image"
import { ParticleFrame, ParticleHeader, ParticleBody } from "./particle-frame"
import { PARTICLE_PREVIEWS } from "./particle-preview"
import { Button } from "@/components/ui/button"
import { ParticleSurfaceContext } from "./particle-surface"
import { ParticleFormHeader } from "./particle-form-header"
import { ParticleEventCard } from "./particle-event-card"

import type { ParticleNodeData } from "./particle-node"

export function ParticleCard(props: ComponentProps<typeof ParticleCardContent>) {
  return <ParticleSurfaceContext.Provider value={props.data.particle}><ParticleCardContent {...props} /></ParticleSurfaceContext.Provider>
}

function ParticleCardContent({
  data,
  selected = false,
  controls = true,
  headerAction,
  onNotesDraftChange,
  editorFields,
}: {
  data: ParticleNodeData
  /** Preset configuration shares the card surface; never shown on canvas. */
  editorFields?: ReactNode
  selected?: boolean
  controls?: boolean
  headerAction?: ReactNode
  onNotesDraftChange?: (content: string) => void
}) {
  const { particle, editable, onOpen, onEdit } = data
  if (particle.type === "activity" && particle.data.widget?.kind === "event")
    return (
      <ParticleEventCard editorFields={editorFields} title={particle.title} event={particle.data.widget} selected={selected}>
        {controls && <ParticleActionMenu data={data} selected={selected}/>}
      </ParticleEventCard>
    )
  if (isImagePlaceholder(particle))
    return (
      <ParticleImagePlaceholder
        editorFields={editorFields}
        data={data}
        selected={selected}
        controls={controls}
      />
    )
  if (getParticleDocument(particle))
    return (
      <ParticleDocumentCard
        data={data}
        selected={selected}
        controls={controls}
      />
    )
  if (getParticleImage(particle))
    return (
      <ParticleImageCard data={data} selected={selected} controls={controls} />
    )
  const Icon = particleIcon(particle)
  const Preview = PARTICLE_PREVIEWS[particle.type]
  const open = (calendarEntryId?: string) =>
    onOpen(particle.id, { calendarEntryId })
  const form = particle.type === "activity" && particle.data.widget?.kind === "form" ? particle.data.widget : null
  return (
    <ParticleFrame selected={selected} className="bg-muted">
      {controls && <ParticleActionMenu data={data} selected={selected} />}
      {form ? <ParticleFormHeader
        count={form.definition.questions.length}
        title={editorFields ? "Form" : particle.title}
        actions={headerAction ?? <Button type="button" variant="ghost" size="sm" className="nodrag nopan h-7 rounded-full px-2 text-xs [@media(pointer:coarse)]:min-h-11" onClick={() => open()}>{editable ? "Edit" : "View"}</Button>}
      /> : <ParticleHeader
        title={particle.title}
        action={headerAction}
        icon={<Icon className="size-4" />}
      />}
      <ParticleBody>
        {editorFields}
        {!(form && editorFields) && <Preview
          particle={particle}
          editable={editable}
          onEdit={onEdit}
          onOpen={open}
          onNotesDraftChange={onNotesDraftChange}
        />}
      </ParticleBody>
    </ParticleFrame>
  )
}
