"use client"

import { useContext, useRef, useState, type ReactNode } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { ParticleLibraryDragContext } from "./particle-library-drag-context"
import { ParticleLibraryDragSource } from "./particle-library-drag-source"
import {
  createLibraryDocumentParticle,
  type ParticleLibraryDocument,
} from "../lib/particle-library-document"
import { particleSchema } from "../lib/particle-schema"

export function ParticleDocumentLibrarySource({
  children,
  document,
  disabled,
  layout = "grid",
}: {
  children: ReactNode
  document: ParticleLibraryDocument | null
  disabled: boolean
  layout?: "grid" | "list"
}) {
  const controller = useContext(ParticleLibraryDragContext)
  const root = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const [adding, setAdding] = useState(false)
  const available = Boolean(
    controller?.workspaceId && controller.place && document && controller.enabled !== false
  )
  const getItem = () => {
    if (!document || !controller?.workspaceId)
      throw new Error("Document placement unavailable.")
    if (document.source?.kind === "workspace_note")
      return {
        request: {
          kind: "existing" as const,
          drag: {
            kind: "particle" as const,
            workspaceId: controller.workspaceId,
            id: document.source.id,
          },
        },
        title: document.title ?? document.name,
        preview: children,
      }
    const image = root.current?.querySelector("img")
    const dimensions =
      image?.naturalWidth && image.naturalHeight
        ? { width: image.naturalWidth, height: image.naturalHeight }
        : undefined
    const particle = particleSchema.parse(
      createLibraryDocumentParticle(
        controller.workspaceId,
        document,
        crypto.randomUUID(),
        new Date().toISOString(),
        dimensions
      )
    )
    return {
      request: { kind: "preset" as const, particle },
      title: particle.title,
      preview: children,
    }
  }
  return (
    <ParticleLibraryDragSource
      ref={root}
      data-can-add-to-canvas={available || undefined}
      disabled={disabled || adding || !available}
      getItem={getItem}
      className="group/document-source relative min-w-0 data-[draggable=true]:cursor-grab"
    >
      {children}
      {available && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "nodrag nopan bg-card text-card-foreground border-border/60 pointer-events-none absolute top-2 left-2 z-30 size-8 rounded-full border opacity-0 transition-opacity duration-100 group-hover/document-source:pointer-events-auto group-hover/document-source:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:size-11",
            layout === "list" && "top-1/2 right-24 left-auto -translate-y-1/2"
          )}
          title="Add to canvas"
          aria-label={`Add ${document?.title ?? document?.name} to canvas`}
          disabled={disabled || adding}
          onClick={async () => {
            if (inFlight.current || !controller?.place) return
            inFlight.current = true
            setAdding(true)
            try {
              if (!(await controller.place(getItem().request)))
                toast.error(
                  "Document could not be added. Check the workspace message and retry."
                )
            } catch {
              toast.error(
                "Document could not be added. Reload its library and try again."
              )
            } finally {
              inFlight.current = false
              setAdding(false)
            }
          }}
        >
          <PlusIcon aria-hidden className="size-4" />
        </Button>
      )}
    </ParticleLibraryDragSource>
  )
}
