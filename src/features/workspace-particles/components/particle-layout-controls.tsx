"use client"

import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { useEffect, useMemo } from "react"
import { useStore } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { useParticleLayout } from "../hooks/use-particle-layout"
import { createParticleGeometrySelector } from "../lib/particle-geometry-observer"

export function ParticleGeometryObserver({
  onChange,
}: {
  onChange: () => void
}) {
  const selectGeometry = useMemo(() => createParticleGeometrySelector(), [])
  const key = useStore(selectGeometry)
  useEffect(() => onChange(), [key, onChange])
  return null
}

export function ParticleLayoutActions({
  layout,
  disabled,
}: {
  layout: ReturnType<typeof useParticleLayout>
  disabled: boolean
}) {
  const saving = layout.phase === "saving" || layout.phase === "animating"
  const actions = [
    {
      id: "layout-all",
      label: "Auto-layout",
      disabled: disabled || layout.busy,
      onClick: () => void layout.run(),
    },
    {
      id: "layout-selection",
      label: "Arrange selection",
      disabled: disabled || layout.busy,
      onClick: () => void layout.run(true),
    },
    ...(layout.busy
      ? [
          {
            id: "layout-cancel",
            label: "Cancel layout",
            disabled: saving,
            onClick: layout.cancel,
          },
        ]
      : []),
  ]
  return (
    <div
      className="nodrag nopan flex flex-col gap-1 border-t px-2 py-2"
      role="group"
      aria-label="Arrange Particles"
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="ghost"
          className="h-11 justify-start rounded-xl px-3"
          disabled={action.disabled}
          onClick={action.onClick}
          {...getReactGrabOwnerProps({
            ownerId: `workspace-particle:${action.id}`,
            component: "ParticleLayoutActions",
            source:
              "src/features/workspace-particles/components/particle-layout-controls.tsx",
            slot: "trigger",
            primitiveImport: "@/components/ui/button",
          })}
        >
          {action.id === "layout-all" && layout.busy ? (
            <LoaderCircleIcon
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {action.label}
        </Button>
      ))}
      <p role="status" className="text-muted-foreground max-w-64 px-3 text-xs">
        {layout.busy
          ? {
              measuring: "Measuring cards…",
              calculating: "Arranging Particles…",
              saving: "Saving positions…",
              animating: "Moving into place…",
              idle: "",
            }[layout.phase]
          : layout.message}
      </p>
    </div>
  )
}
