"use client"

import { ParticleLibraryDragSource } from "./particle-library-drag-source"
import { ReactGrabPreview } from "@/components/dev/react-grab-preview"

import { ParticleAddControl } from "./particle-add-control"
import type { ReactNode } from "react"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ParticleMenuOverlay } from "./particle-menu-overlay"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { type ParticleDrag } from "../lib/particle-placement"

export type ParticleLibraryTool = {
  id: string
  title: string
  subtitle: string
  visible: boolean
  icon?: ReactNode
  preview: ReactNode
  drag: ParticleDrag
  onPlace: (visible: boolean) => void
}

export function ParticleLibraryTile({
  title,
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
          : "mb-3 break-inside-avoid"
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
        <ParticleLibraryDragSource
          disabled={disabled}
          getItem={() => ({
            request: { kind: "existing", drag },
            title,
            preview,
          })}
          className="relative data-[draggable=true]:cursor-grab"
        >
          <ReactGrabPreview>{preview}</ReactGrabPreview>
          <ParticleAddControl
            title={title}
            disabled={disabled}
            onAdd={() => onPlace(true)}
          />
        </ParticleLibraryDragSource>
      )}
      {visible && (
        <div className="flex w-full items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="py-1 text-sm font-medium break-words">{title}</p>
            <p className="text-muted-foreground text-xs">On canvas</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 rounded-full"
            disabled={disabled}
            aria-label={`Remove ${title} from canvas`}
            onClick={() => onPlace(false)}
          >
            <MinusIcon aria-hidden />
          </Button>
        </div>
      )}
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
    <ParticleMenuOverlay title={title}>
      <DropdownMenuItem
        disabled={disabled}
        onSelect={onRemove}
        className="min-h-9 gap-2.5 rounded-lg px-2.5 [@media(hover:none)]:min-h-11"
      >
        <MinusIcon aria-hidden />
        Remove from canvas
      </DropdownMenuItem>
    </ParticleMenuOverlay>
  )
}
