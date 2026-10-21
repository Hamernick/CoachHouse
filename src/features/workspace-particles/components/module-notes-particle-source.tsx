"use client"

import { useContext, useRef, useState, type ReactNode } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { ParticleLibraryDragContext } from "./particle-library-drag-context"
import { ParticleLibraryDragSource } from "./particle-library-drag-source"
import { moduleNotesParticle } from "../lib/particle-notes"
import { useParticleSurface } from "./particle-surface"

export function ModuleNotesParticleSource({
  moduleId,
  title,
  children,
}: {
  moduleId: string
  title: string
  children: (action: ReactNode, preview: boolean) => ReactNode
}) {
  const surface = useParticleSurface(
    "ModuleNotesParticleSource",
    "module-notes-particle-source.tsx"
  )
  const controller = useContext(ParticleLibraryDragContext)
  const busy = useRef(false)
  const [adding, setAdding] = useState(false)
  const enabled = Boolean(
    controller?.workspaceId && controller.enabled !== false
  )
  const getItem = () => {
    if (!controller?.workspaceId) throw new Error("Canvas unavailable.")
    const particle = moduleNotesParticle({
      workspaceId: controller.workspaceId,
      id: crypto.randomUUID(),
      now: new Date().toISOString(),
      moduleId,
      title,
    })
    return {
      request: { kind: "preset" as const, particle },
      title,
      preview: children(null, true),
    }
  }
  const action = enabled ? (
    <Button
      {...surface("add")}
      type="button"
      variant="ghost"
      size="icon"
      className="nodrag nopan size-7 rounded-full [@media(pointer:coarse)]:size-11"
      disabled={adding}
      aria-label="Add lesson notes to canvas"
      onClick={async () => {
        if (busy.current || !controller?.place) return
        busy.current = true
        setAdding(true)
        try {
          if (!(await controller.place(getItem().request)))
            toast.error("Notes were not placed. Try again.")
        } catch {
          toast.error("Unable to place notes. Try again.")
        } finally {
          busy.current = false
          setAdding(false)
        }
      }}
    >
      <PlusIcon aria-hidden />
    </Button>
  ) : null
  return (
    <ParticleLibraryDragSource
      disabled={!enabled || adding}
      getItem={getItem}
      className="relative"
    >
      {children(action, false)}
    </ParticleLibraryDragSource>
  )
}
