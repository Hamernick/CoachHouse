"use client"

import { useRef, useState, type ReactNode } from "react"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { PARTICLE_IMAGE_ACCEPT } from "../lib/particle-image"
import { PARTICLE_IMAGE_CAPTION_HEIGHT } from "../lib/particle-size"
import { ParticleFrame } from "./particle-frame"
import { ParticleActionMenu } from "./particle-action-menu"
import { useParticleSurface } from "./particle-surface"
import type { ParticleNodeData } from "./particle-node"

export function ParticleImagePlaceholder({
  data,
  selected,
  controls,
  editorFields,
}: {
  data: ParticleNodeData
  selected: boolean
  controls: boolean
  editorFields?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const surface = useParticleSurface(
    "ParticleImagePlaceholder",
    "particle-image-placeholder.tsx"
  )
  const enabled =
    controls &&
    data.editable &&
    !data.particle.locked &&
    Boolean(data.onUploadImage)
  const upload = async (files: File[]) => {
    if (!enabled || running.current || !files.length) return
    running.current = true
    setPending(true)
    setError(null)
    try {
      if (!(await data.onUploadImage?.(data.particle.id, files)))
        setError("Image not attached. Check the upload message.")
    } catch {
      setError("Unable to upload. Try again.")
    } finally {
      running.current = false
      setPending(false)
    }
  }
  const content = (
    <>
      {pending ? (
        <LoaderCircleIcon
          className="size-6 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ) : (
        <ImageIcon className="size-7" aria-hidden />
      )}
      {controls && (
        <span className="text-xs">
          {pending ? "Uploading…" : "Drop an image here"}
        </span>
      )}
    </>
  )
  return (
    <ParticleFrame selected={selected} className="gap-0 rounded-[22px] p-0">
      {controls && <ParticleActionMenu data={data} selected={selected} />}
      {editorFields && <div className="min-w-0 p-3">{editorFields}</div>}
      <figure {...surface("placeholder")} className="particle-file-figure workspace-card-drag-handle cursor-grab active:cursor-grabbing">
        <div
          {...surface("drop-target")}
          className="particle-file-preview bg-muted/40 text-muted-foreground border-border/60 data-[over=true]:border-ring data-[over=true]:bg-accent relative overflow-hidden rounded-[21px] border border-dashed"
          data-over={hovering}
          style={{ aspectRatio: "16 / 9" }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect =
              enabled && !pending ? "copy" : "none"
            setHovering(enabled && !pending)
          }}
          onDragLeave={(event) => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            )
              setHovering(false)
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return
            event.preventDefault()
            event.stopPropagation()
            setHovering(false)
            void upload(Array.from(event.dataTransfer.files))
          }}
        >
          {controls ? (
            <Button
              {...surface("choose-image")}
              type="button"
              variant="ghost"
              disabled={!enabled || pending}
              onClick={() => input.current?.click()}
              aria-label="Choose image for this placeholder"
              aria-busy={pending}
              className="nodrag nopan absolute top-1/2 left-1/2 h-auto min-h-11 w-auto max-w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-xl px-3 py-2 shadow-none"
            >
              {content}
            </Button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {content}
            </div>
          )}
          <input
            {...surface("file-input")}
            ref={input}
            type="file"
            accept={PARTICLE_IMAGE_ACCEPT}
            disabled={!enabled || pending}
            hidden
            aria-label="Choose placeholder image"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ""
              void upload(files)
            }}
          />
        </div>
        <figcaption
          {...surface("title")}
          className="truncate px-3 text-sm font-medium"
          style={{
            height: PARTICLE_IMAGE_CAPTION_HEIGHT,
            lineHeight: `${PARTICLE_IMAGE_CAPTION_HEIGHT}px`,
          }}
          title={data.particle.title}
        >
          {data.particle.title}
        </figcaption>
      </figure>
      {error && (
        <span
          {...surface("error")}
          role="status"
          className="bg-background absolute right-2 bottom-10 left-2 rounded-lg p-2 text-xs"
        >
          {error}
        </span>
      )}
    </ParticleFrame>
  )
}
