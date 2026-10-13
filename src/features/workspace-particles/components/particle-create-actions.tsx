"use client"

import TargetIcon from "lucide-react/dist/esm/icons/target"
import CheckSquareIcon from "lucide-react/dist/esm/icons/square-check"
import ListOrderedIcon from "lucide-react/dist/esm/icons/list-ordered"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { PARTICLE_CREATE_TYPES } from "../lib/particle-command"
import { particleRegistry } from "../lib/particle-registry"
import type { ParticleType } from "../types"

const ICONS = {
  objective: TargetIcon,
  activity: CheckSquareIcon,
  workflow: ListOrderedIcon,
}
export function ParticleCreateActions({
  disabled,
  onCreate,
}: {
  disabled: boolean
  onCreate: (type: ParticleType, title: string) => Promise<boolean>
}) {
  return (
    <div
      className="flex flex-col gap-1 p-2"
      role="group"
      aria-label="Add Particle"
    >
      <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium">
        Add Particle
      </p>
      {PARTICLE_CREATE_TYPES.map((type) => {
        const Icon = ICONS[type]
        return (
          <Button
            key={type}
            type="button"
            variant="ghost"
            disabled={disabled}
            className="h-11 justify-start gap-3 rounded-xl px-3 transition-colors duration-150 motion-reduce:transition-none"
            {...getReactGrabOwnerProps({
              ownerId: `workspace-particle:create-${type}`,
              component: "ParticleCreateActions",
              source:
                "src/features/workspace-particles/components/particle-create-actions.tsx",
              slot: "trigger",
              tokenSource: "src/app/globals.css",
              primitiveImport: "@/components/ui/button",
            })}
            onClick={() => void onCreate(type, particleRegistry[type].label)}
          >
            <Icon aria-hidden />
            {particleRegistry[type].label}
          </Button>
        )
      })}
    </div>
  )
}
