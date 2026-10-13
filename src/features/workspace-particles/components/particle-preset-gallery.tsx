"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ParticleCard } from "./particle-card"
import {
  buildParticlePreset,
  DEFAULT_PRESET_FIELDS,
  filterParticlePresets,
  type ParticlePreset,
} from "../lib/particle-presets"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"

export function ParticlePresetGallery({
  query,
  disabled,
  workspaceId,
  onSelect,
}: {
  query: string
  disabled: boolean
  workspaceId: string
  onSelect: (preset: ParticlePreset) => void
}) {
  const presets = useMemo(
    () =>
      filterParticlePresets(query).map((preset) => ({
        preset,
        preview: buildParticlePreset(preset, {
          id: "00000000-0000-4000-8000-000000000001",
          workspaceId,
          now: "2026-10-12T00:00:00.000Z",
          title: preset.label,
          description: preset.hint,
          fields: {
            ...DEFAULT_PRESET_FIELDS,
            expression: "120 / 4",
            lines: "First step\nNext step",
            body: "Write your message here.",
          },
        }),
      })),
    [query, workspaceId]
  )
  if (!presets.length) return null
  return (
    <ul className="columns-[280px] gap-4" aria-label="Particle presets">
      {presets.map(({ preset, preview }) => (
        <li key={preset.id} className="mb-4 break-inside-avoid">
          <div
            className="relative"
            {...getReactGrabOwnerProps({
              ownerId: `workspace-particle:preset:${preset.id}`,
              component: "ParticlePresetGallery",
              source:
                "src/features/workspace-particles/components/particle-preset-gallery.tsx",
            })}
          >
            <div inert className="pointer-events-none select-none">
              <ParticleCard
                controls={false}
                data={{
                  particle: preview,
                  editable: false,
                  onEdit: () => {},
                  onOpen: () => {},
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onSelect(preset)}
              className="hover:bg-accent/10 absolute inset-0 h-full w-full rounded-[2rem] bg-transparent"
              aria-label={`Configure ${preset.label}`}
            >
              <span className="sr-only">Configure {preset.label}</span>
            </Button>
          </div>
          <p className="text-muted-foreground px-3 pt-2 text-xs">
            Preset · {preset.hint}
          </p>
        </li>
      ))}
    </ul>
  )
}
