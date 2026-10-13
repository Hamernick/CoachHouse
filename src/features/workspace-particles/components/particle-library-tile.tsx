"use client"

import type { ReactNode } from "react"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import {
  PARTICLE_DRAG_MIME,
  type ParticleDrag,
} from "../lib/particle-placement"

export type ParticleLibraryTool = {
  id: string
  title: string
  subtitle: string
  visible: boolean
  preview: ReactNode
  drag: ParticleDrag
  onPlace: (visible: boolean) => void
}

export function ParticleLibraryTile({
  title,
  subtitle,
  visible,
  preview,
  drag,
  onPlace,
  disabled,
}: ParticleLibraryTool & { disabled: boolean }) {
  return (
    <li
      className={
        visible
          ? "border-border flex items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-2"
          : "mb-5 break-inside-avoid p-1"
      }
      {...getReactGrabOwnerProps({
        ownerId: `workspace-particle:library:${drag.id}`,
        component: visible
          ? "ParticleLibraryPlaceholder"
          : "ParticleLibraryPreview",
        source:
          "src/features/workspace-particles/components/particle-library-tile.tsx",
      })}
    >
      {!visible && (
        <div
          draggable={!disabled}
          onDragStart={(event) => {
            if (disabled) {
              event.preventDefault()
              return
            }
            event.dataTransfer.effectAllowed = "move"
            event.dataTransfer.setData(PARTICLE_DRAG_MIME, JSON.stringify(drag))
          }}
          className="relative data-[draggable=true]:cursor-grab"
          data-draggable={!disabled}
        >
          <div inert className="pointer-events-none select-none">
            {preview}
          </div>
        </div>
      )}
      <div
        className={
          visible
            ? "flex w-full items-center justify-between gap-2"
            : "flex items-start justify-between gap-2 px-2 pt-2.5"
        }
      >
        <div className="min-w-0">
          <p className="py-1 text-sm font-medium break-words">{title}</p>
          <p className="text-muted-foreground text-xs">
            {visible ? "On canvas" : subtitle}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled}
          aria-label={`${visible ? "Remove" : "Add"} ${title} ${visible ? "from" : "to"} canvas`}
          onClick={() => onPlace(!visible)}
        >
          {visible ? <MinusIcon aria-hidden /> : <PlusIcon aria-hidden />}
        </Button>
      </div>
    </li>
  )
}

export function ParticleRemoveControl({
  title,
  onRemove,
  disabled = false,
}: {
  title: string
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      disabled={disabled}
      aria-label={`Remove ${title} from canvas`}
      className="nodrag nopan absolute -top-3 -left-3 z-10 size-8 rounded-full border opacity-0 shadow-none transition-opacity duration-100 group-focus-within/particle:opacity-100 group-hover/particle:opacity-100 motion-reduce:transition-none [@media(hover:none)]:size-11 [@media(hover:none)]:opacity-100"
      onClick={onRemove}
    >
      <MinusIcon aria-hidden />
    </Button>
  )
}
