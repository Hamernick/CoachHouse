"use client"

import { getReactGrabInspectionProps } from "@/components/dev/react-grab-surface"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
}: {
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
  const query = externalQuery ?? ""
  const [preset, setPreset] = useState<ParticlePreset | null>(null)
  const editingPreset = Boolean(preset && workspaceId && onAddPreset)
  const hasActivityPreset = Boolean(workspaceId && onAddPreset && filterParticlePresets(query).some(item => item.id === "activity"))
  const records = particles
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
    <>
      {preset && workspaceId && onAddPreset ? (
      <ParticlePresetEditor
        key={`${workspaceId}:${preset.id}`}
        preset={preset}
        workspaceId={workspaceId}
        disabled={!editable}
        pending={pending}
        error={error}
        onRetry={onRetry}
        onBack={() => setPreset(null)}
        onAdd={onAddPreset}
      />
      ) : null}
    <section
      className={`nodrag nopan nowheel min-h-0 flex-col gap-3 px-4 pt-1 pb-4 ${editingPreset ? "hidden" : "flex"}`}
      inert={editingPreset}
      aria-label="Particles"
      aria-busy={pending}
      {...getReactGrabInspectionProps("granular")}
    >
      {!canEdit ? (
        <p className="text-muted-foreground text-xs">View only</p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onRetry}
            >
              {pending ? "Retrying…" : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {workspaceId && onAddPreset && (
        <ParticlePresetGallery
          workspaceId={workspaceId}
          query={query}
          disabled={!editable}
          onSelect={setPreset}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
        <Empty
          size="sm"
          className="h-auto shadow-none"
          title={
            query.trim()
              ? "No matches"
              : particles.length || tools.length
                ? "No available Particles"
                : "No Particles yet"
          }
          description={
            query.trim()
              ? "Try another title or type."
              : particles.length || tools.length
                ? undefined
                : "Add a Particle to start your plan."
          }
        />
      ) : null}
    </section>
    </>
  )
}
