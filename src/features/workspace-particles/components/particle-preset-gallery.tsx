"use client"

import { particleInspectionProps } from "./particle-surface"

import { InertPreview } from "@/components/shared/inert-preview"

import { ParticleLibraryDragSource } from "./particle-library-drag-source"
import { ParticleLibraryCardStack } from "./particle-library-card-stack"
import { ParticleAddControl } from "./particle-add-control"
import { useParticlePresetPlacement } from "../hooks/use-particle-preset-placement"
import type { Particle } from "../types"
import { useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PARTICLE_LIBRARY_CARD_SHAPE,
  particleLibraryLayout,
} from "./particle-library-view"
import { ParticleCard } from "./particle-card"
import { ParticleEventCard } from "./particle-event-card"
import { EMPTY_EVENT_DRAFT, eventDraftError, eventDraftInput } from "../lib/particle-event"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  filterParticlePresets,
  type ParticlePreset,
} from "../lib/particle-presets"

export function ParticlePresetGallery({
  query,
  disabled,
  workspaceId,
  onSelect,
  onAdd,
  existingIds = [],
  children,
}: {
  children?: ReactNode
  query: string
  disabled: boolean
  workspaceId: string
  onSelect: (preset: ParticlePreset) => void
  onAdd?: (particle: Particle) => Promise<boolean>
  existingIds?: readonly string[]
}) {
  const placement = useParticlePresetPlacement(workspaceId, onAdd, existingIds)
  const [notesDraft, setNotesDraft] = useState({ workspaceId, content: "" })
  const notesContent =
    notesDraft.workspaceId === workspaceId ? notesDraft.content : ""
  const [eventDraft, setEventDraft] = useState({ workspaceId, ...EMPTY_EVENT_DRAFT })
  const event = eventDraft.workspaceId === workspaceId ? eventDraft : EMPTY_EVENT_DRAFT
  const eventProblem = eventDraftError(event)
  const eventInput = useMemo(() => eventDraftError(event) ? undefined : eventDraftInput(event), [event])
  const presets = useMemo(
    () =>
      filterParticlePresets(query).map((preset) => ({
        preset,
        preview: buildParticlePreset(preset, {
          id: "00000000-0000-4000-8000-000000000001",
          workspaceId,
          now: "2026-10-12T00:00:00.000Z",
          title: preset.id === "event" ? eventInput?.title ?? preset.label : preset.label,
          description: preset.hint,
          fields: {
            ...DEFAULT_PRESET_FIELDS,
            expression: "0",
            ...(preset.id === "notes" ? { body: notesContent } : {}),
            ...(preset.id === "event" ? eventInput?.fields : {}),
          },
        }),
      })),
    [query, workspaceId, notesContent, eventInput]
  )
  if (!presets.length && !children) return null
  return (
    <>
      <ul className={particleLibraryLayout()} aria-label="Available Particles">
        {presets.map(({ preset, preview }) => {
          const notesFields =
            preset.id === "notes" ? { body: notesContent } : undefined
          const fields = preset.id === "event" ? eventInput?.fields : notesFields
          const title = preset.id === "event" ? eventInput?.title ?? preset.label : preset.label
          const inlineNotes = preset.id === "notes"
          const inlineEvent = preset.id === "event"
          const card = (
            inlineEvent && preview.type === "activity" && preview.data.widget?.kind === "event" ?
            <ParticleEventCard title={title} event={preview.data.widget} draft={event}
              onChange={draft => setEventDraft({ workspaceId, ...draft })}
              onClear={() => setEventDraft({ workspaceId, ...EMPTY_EVENT_DRAFT })}
              onAdd={onAdd ? () => { if (eventInput) void placement.add(preset, eventInput.fields, eventInput.title) } : undefined}
              disabled={disabled} pending={placement.adding}/>
            :
            <ParticleCard
              controls={false}
              headerAction={
                onAdd ? <span className="size-8 shrink-0" aria-hidden /> : undefined
              }
              onNotesDraftChange={
                inlineNotes
                  ? content => setNotesDraft({ workspaceId, content })
                  : undefined
              }
              data={{
                particle: preview,
                editable: inlineNotes && !disabled && !placement.adding,
                onEdit: () => {},
                onOpen: () => {},
              }}
            />
          )
          return (
            <li
              {...particleInspectionProps(preview)}
              key={preset.id}
              className="mb-3 break-inside-avoid"
            >
              <ParticleLibraryCardStack
                enabled={Boolean(onAdd)}
              >
                {(getPlacement) => (
                  <ParticleLibraryDragSource
                    getPlacement={getPlacement}
                    touchHandleClassName={inlineEvent ? "top-0 right-0 bottom-auto left-auto" : undefined}
                    disabled={disabled || placement.adding || !onAdd || (preset.id === "event" && Boolean(eventProblem))}
                    getItem={() => ({
                      request: {
                        kind: "preset",
                        particle: placement.prepare(preset, fields, title),
                      },
                      title: preset.label,
                      preview: inlineEvent ? card : (
                        <ParticleCard
                          controls={false}
                          onNotesDraftChange={inlineNotes ? () => {} : undefined}
                          headerAction={
                            <span className="size-8 shrink-0" aria-hidden />
                          }
                          data={{
                            particle: preview,
                            editable: inlineNotes,
                            onEdit: () => {},
                            onOpen: () => {},
                          }}
                        />
                      ),
                    })}
                    className={cn(
                      "relative h-full data-[draggable=true]:cursor-grab",
                      PARTICLE_LIBRARY_CARD_SHAPE
                    )}

                  >
                    {inlineNotes || inlineEvent ? card : (
                      <InertPreview>{card}</InertPreview>
                    )}
                    {!inlineNotes && !inlineEvent && (
                      <Button
                      data-particle-drag-surface="true"
                      type="button"
                      variant="ghost"
                      disabled={
                        disabled ||
                        placement.adding ||
                        (preset.id === "image" && !onAdd)
                      }
                      onClick={() =>
                        preset.id === "image"
                          ? void placement.add(preset)
                          : onSelect(preset)
                      }

                      className="hover:bg-accent/10 dark:hover:bg-accent/10 absolute inset-0 h-full w-full rounded-[inherit] bg-transparent"
                      aria-label={
                        preset.id === "image"
                          ? "Add image placeholder"
                          : `Configure ${preset.label}`
                      }
                    >
                      <span className="sr-only">
                        {preset.id === "image"
                          ? "Add image placeholder"
                          : `Configure ${preset.label}`}
                      </span>
                      </Button>
                    )}
                    {onAdd && !inlineEvent && (
                      <ParticleAddControl
                        title={preset.label}
                        disabled={disabled || placement.adding || (preset.id === "event" && Boolean(eventProblem))}
                        onAdd={() => {
                          if (preset.id !== "event" || eventInput) void placement.add(preset, fields, title)
                        }}
                      />
                    )}
                  </ParticleLibraryDragSource>
                )}
              </ParticleLibraryCardStack>
            </li>
          )
        })}
        {children}
      </ul>
      <p
        role="status"
        className={
          placement.message ? "text-muted-foreground text-xs" : "sr-only"
        }
      >
        {placement.message}
      </p>
    </>
  )
}
