"use client"

import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Empty } from "@/components/ui/empty"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { ParticlePresetEditor } from "./particle-preset-editor"
import { ParticlePresetGallery } from "./particle-preset-gallery"
import {
  filterParticlePresets,
  type ParticlePreset,
} from "../lib/particle-presets"
import { ParticleCard } from "./particle-card"
import {
  ParticleLibraryTile,
  type ParticleLibraryTool,
} from "./particle-library-tile"
import { particleRegistry } from "../lib/particle-registry"
import {
  filterParticleLibrary,
  filterParticleLibraryTools,
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
  onQueryChange,
}: {
  workspaceId?: string
  externalQuery?: string
  onQueryChange?: (query: string) => void
  onAddPreset?: (particle: Particle) => Promise<boolean>
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
  const [query, setQuery] = useState("")
  const [preset, setPreset] = useState<ParticlePreset | null>(null)
  useEffect(() => {
    if (externalQuery !== undefined) setQuery(externalQuery)
  }, [externalQuery])
  const searchId = useId()
  const records = particles ? filterParticleLibrary(particles, query) : []
  const matchingTools = filterParticleLibraryTools(tools, query)
  const entries: ParticleLibraryTool[] = [
    ...matchingTools,
    ...records.map((particle) => ({
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
          data={{
            particle,
            editable: false,
            onEdit: () => {},
            onOpen: () => {},
          }}
        />
      ),
    })),
  ]
  const available = entries.filter((entry) => !entry.visible)
  const placed = entries.filter((entry) => entry.visible)
  const tile = (entry: ParticleLibraryTool) => (
    <ParticleLibraryTile
      key={`${entry.drag.kind}:${entry.id}`}
      {...entry}
      disabled={!editable || (entry.drag.kind === "particle" && !onPlace)}
    />
  )
  if (preset && workspaceId && onAddPreset)
    return (
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
    )
  return (
    <section
      className="nodrag nopan nowheel flex min-h-0 flex-col gap-3 p-4"
      aria-label="Particles"
      aria-busy={pending}
      {...getReactGrabOwnerProps({
        ownerId: "workspace-particle:library",
        component: "ParticleLibrary",
        source:
          "src/features/workspace-particles/components/particle-library.tsx",
      })}
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={searchId} className="sr-only">
          Search Particles
        </Label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            onQueryChange?.(event.target.value)
          }}
          placeholder="Search Particles…"
          disabled={!particles && tools.length === 0}
          className="bg-muted/40 h-11 rounded-full border-0 px-4 text-base shadow-none md:text-sm"
        />
      </div>
      {workspaceId && onAddPreset && (
        <ParticlePresetGallery
          workspaceId={workspaceId}
          query={query}
          disabled={!editable}
          onSelect={setPreset}
        />
      )}
      {records.length || matchingTools.length ? (
        <>
          {available.length > 0 && (
            <ul
              className="columns-[320px] gap-4"
              aria-label="Available Particles"
            >
              {available.map(tile)}
            </ul>
          )}
          {placed.length > 0 && (
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Particles on canvas"
            >
              {placed.map(tile)}
            </ul>
          )}
        </>
      ) : particles &&
        !(workspaceId && onAddPreset && filterParticlePresets(query).length) ? (
        <Empty
          size="sm"
          className="h-auto shadow-none"
          title={query.trim() ? "No matches" : "No Particles yet"}
          description={
            query.trim()
              ? "Try another title or type."
              : "Add a Particle to start your plan."
          }
        />
      ) : null}
    </section>
  )
}
