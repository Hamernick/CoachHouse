"use client"

import { ParticleButton as Button, ParticleInput as Input, ParticleAlert, ParticleEmptyMessage } from "@/components/ui/particle-ui"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { ParticlePresetEditor } from "./particle-preset-editor"
import { ParticlePresetGallery } from "./particle-preset-gallery"
import {
  filterParticlePresets,
  type ParticlePreset,
} from "../lib/particle-presets"
import { particleIcon } from "./particle-preset-icons"
import { particleLibraryLayout } from "./particle-library-view"
import { ParticleCard } from "./particle-card"
import {
  ParticleLibraryTile,
  type ParticleLibraryTool,
} from "./particle-library-tile"
import { particleRegistry } from "../lib/particle-registry"
import {
  filterParticleLibrary,
  filterParticleLibraryTools,
  isEmptyActivityLibraryDuplicate,
} from "../lib/particle-library"
import type { Particle, ParticleType } from "../types"

export function ParticleLibrary({
  particles,
  includeSavedParticles = true,
  tools = [],
  onPlace,
  editable,
  canEdit,
  pending,
  error,
  onRetry,
  workspaceId,
  externalQuery,
  onAddPreset,
  images,
  connectedParticleIds = [],
  beforeLibrary,
  focusRequestId,
  backLabel,
}: {
  beforeLibrary?: ReactNode
  focusRequestId?: number
  backLabel?: string
  connectedParticleIds?: readonly string[]
  workspaceId?: string
  externalQuery?: string
  onAddPreset?: (particle: Particle) => Promise<boolean>
  images?: {
    upload: (files: File[]) => Promise<boolean>
    retry: () => Promise<boolean>
    canRetry: boolean
    pending: boolean
    message: string | null
  }
  includeSavedParticles?: boolean
  particles: readonly Particle[] | null
  tools?: readonly ParticleLibraryTool[]
  onPlace?: (id: string, visible: boolean) => void
  editable: boolean
  canEdit: boolean
  pending: boolean
  error: string | null
  onCreate: (type: ParticleType, title: string) => Promise<boolean>
  onRetry: () => void
}) {
  const [search, setSearch] = useState({ external: externalQuery, value: externalQuery ?? "" })
  if (search.external !== externalQuery) setSearch({ external: externalQuery, value: externalQuery ?? "" })
  const query = search.external === externalQuery ? search.value : externalQuery ?? ""
  const viewport = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const scrollTop = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const wasEditing = useRef(false)
  const handledFocus = useRef<number | undefined>(undefined)
  const [preset, setPreset] = useState<ParticlePreset | null>(null)
  const editingPreset = Boolean(preset && workspaceId && onAddPreset)
  useLayoutEffect(() => {
    if (editingPreset) { wasEditing.current = true; return }
    if (wasEditing.current) {
      wasEditing.current = false
      if (viewport.current) viewport.current.scrollTop = scrollTop.current
      returnFocus.current?.focus({ preventScroll: true })
    }
    if (focusRequestId !== undefined && handledFocus.current !== focusRequestId) {
      handledFocus.current = focusRequestId
      searchInput.current?.focus({ preventScroll: true })
      // Scroll only this view; never move the anchored dock or page.
      if (viewport.current && searchInput.current) {
        viewport.current.scrollTop += searchInput.current.getBoundingClientRect().top - viewport.current.getBoundingClientRect().top - 12
      }
    }
  }, [editingPreset, focusRequestId])
  const selectPreset = (next: ParticlePreset, trigger: HTMLButtonElement) => {
    scrollTop.current = viewport.current?.scrollTop ?? 0
    returnFocus.current = trigger
    setPreset(next)
  }
  const hasActivityPreset = Boolean(workspaceId && onAddPreset && filterParticlePresets(query).some(item => item.id === "activity"))
  const records = particles && includeSavedParticles
    ? filterParticleLibrary(particles, query).filter((particle) => particle.canvasHidden && !(hasActivityPreset && !connectedParticleIds.includes(particle.id) && isEmptyActivityLibraryDuplicate(particle)))
    : []
  const matchingTools = filterParticleLibraryTools(tools, query).filter(
    (tool) => !tool.visible
  )
  const entries: ParticleLibraryTool[] = [
    ...matchingTools,
    ...records.map((particle) => {
      const Icon = particleIcon(particle)
      return {
        icon: <Icon />,
        id: particle.id,
        title: particle.title,
        subtitle: particleRegistry[particle.type].label,
        visible: !particle.canvasHidden,
        drag: {
          kind: "particle" as const,
          workspaceId: particle.workspaceId,
          id: particle.id,
        },
        onPlace: (visible: boolean) => onPlace?.(particle.id, visible),
        preview: (
          <ParticleCard
            controls={false}
            headerAction={
              <span className="size-8 shrink-0" aria-hidden="true" />
            }
            data={{
              particle,
              editable: false,
              onEdit: () => {},
              onOpen: () => {},
            }}
          />
        ),
      }
    }),
  ]
  const tile = (entry: ParticleLibraryTool) => (
    <ParticleLibraryTile
      key={`${entry.drag.kind}:${entry.id}`}
      {...entry}
      disabled={!editable || (entry.drag.kind === "particle" && !onPlace)}
    />
  )
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {preset && workspaceId && onAddPreset ? (
      <ParticlePresetEditor
        key={`${workspaceId}:${preset.id}`}
        preset={preset}
        backLabel={backLabel}
        workspaceId={workspaceId}
        disabled={!editable}
        pending={pending}
        error={error}
        onRetry={onRetry}
        onBack={() => setPreset(null)}
        onAdd={onAddPreset}
      />
      ) : null}
    <div ref={viewport} hidden={editingPreset} inert={editingPreset} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${editingPreset ? "hidden" : ""}`}>
      {beforeLibrary}
    <section
      className="nodrag nopan nowheel flex min-h-0 flex-col gap-3 px-4 pt-1 pb-4"
      aria-label="Particles"
      aria-busy={pending}

    >
      {beforeLibrary ? <h2 className="text-muted-foreground text-xs font-medium">Particles</h2> : null}
      <Input ref={searchInput} size="md" pill aria-label="Search Particles" placeholder="Search Particles…" value={query}
        onChange={event => setSearch({ external: externalQuery, value: event.target.value })} />
      {!canEdit ? (
        <p className="text-muted-foreground text-xs">View only</p>
      ) : null}
      {error ? (
        <div role="alert">
          <ParticleAlert className="particle-ui" color="danger" description={error} actions={
            <Button color="secondary" type="button" variant="outline" size="md" disabled={pending} onClick={onRetry}>
              {pending ? "Retrying…" : "Retry"}
            </Button>
          } />
        </div>
      ) : null}
      {workspaceId && onAddPreset && (
        <ParticlePresetGallery
          workspaceId={workspaceId}
          query={query}
          disabled={!editable}
          onSelect={selectPreset}
          onAdd={onAddPreset}
          existingIds={particles?.map((particle) => particle.id)}
        >
          {entries.length > 0 ? entries.map(tile) : null}
        </ParticlePresetGallery>
      )}
      {images?.message && (
        <p role="status" className="text-muted-foreground text-xs">
          {images.message}
          {images.canRetry && (
            <Button color="secondary"
              type="button"
              variant="ghost"
              size="md"
              disabled={images.pending || !canEdit}
              onClick={() => void images.retry()}
            >
              Retry adding images
            </Button>
          )}
        </p>
      )}
      {entries.length > 0 && !(workspaceId && onAddPreset) ? (
        <ul
          className={particleLibraryLayout()}
          aria-label="Available Particles"
        >
          {entries.map(tile)}
        </ul>
      ) : entries.length === 0 && particles &&
        !(workspaceId && onAddPreset && filterParticlePresets(query).length) ? (
        <ParticleEmptyMessage className="particle-ui h-auto">
          <ParticleEmptyMessage.Title>{query.trim() ? "No matches" : particles.length || tools.length ? "No available Particles" : "No Particles yet"}</ParticleEmptyMessage.Title>
          {query.trim() || !(particles.length || tools.length) ? <ParticleEmptyMessage.Description>{query.trim() ? "Try another title or type." : "Add a Particle to start your plan."}</ParticleEmptyMessage.Description> : null}
        </ParticleEmptyMessage>
      ) : null}
    </section>
    </div>
    </div>
  )
}
