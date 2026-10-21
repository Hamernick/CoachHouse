"use client"

import { useEffect, useRef, useState } from "react"
import {
  NodeResizeControl,
  useUpdateNodeInternals,
  useReactFlow,
} from "@xyflow/react"
import {
  PARTICLE_SIZES,
  nearestParticleSize,
  isImageParticle,
  particleFamilyDimensions,
  particleResizeDimensions,
  supportedParticleSizes,
  type ParticleSize,
} from "../lib/particle-size"
import type { ParticleNodeData } from "./particle-node"
import { useParticleSurface } from "./particle-surface"

export function ParticleResizeControl({
  id,
  data,
}: {
  id: string
  data: ParticleNodeData
}) {
  const active = useRef(false)
  const last = useRef({ width: 0, height: 0 })
  const [preview, setPreview] = useState<ParticleSize | null>(null)
  const update = useUpdateNodeInternals()
  const flowNode = useReactFlow().getNode(id)
  const surface = useParticleSurface(
    "ParticleResizeControl",
    "particle-resize-control.tsx"
  )
  const allowed = supportedParticleSizes(data.particle)
  const presets = allowed.map((size) =>
    particleFamilyDimensions(data.particle, size)
  )
  const controls = data.resize
  useEffect(() => {
    const cancel = () => {
      if (!active.current) return
      active.current = false
      setPreview(null)
      void controls?.finish(id, last.current, true)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel()
    }
    document.addEventListener("keydown", key)
    window.addEventListener("blur", cancel)
    window.addEventListener("pointercancel", cancel)
    return () => {
      document.removeEventListener("keydown", key)
      window.removeEventListener("blur", cancel)
      window.removeEventListener("pointercancel", cancel)
      cancel()
    }
  }, [controls, id, data.editable, data.particle.locked])
  if (!data.editable || data.particle.locked || !controls) return null
  return (
    <>
      <NodeResizeControl
        nodeId={id}
        position="bottom-right"
        autoScale
        resizeDirection={
          isImageParticle(data.particle) ? "horizontal" : undefined
        }
        minWidth={Math.min(
          flowNode?.measured?.width ?? 192,
          ...presets.map((size) => size.width)
        )}
        minHeight={Math.min(
          flowNode?.measured?.height ?? 192,
          ...presets.map((size) => size.height)
        )}
        maxWidth={Math.max(
          flowNode?.measured?.width ?? 192,
          ...presets.map((size) => size.width)
        )}
        maxHeight={Math.max(
          flowNode?.measured?.height ?? 192,
          ...presets.map((size) => size.height)
        )}
        className="nodrag nopan nowheel !border-0 !bg-transparent"
        style={{ width: 44, height: 44 }}
        shouldResize={() => active.current}
        onResizeStart={(_, dimensions) => {
          active.current = controls.begin(id, dimensions)
          last.current = dimensions
        }}
        onResize={(_, dimensions) => {
          if (!active.current) return
          last.current = dimensions
          controls.preview(id, dimensions)
          setPreview(
            nearestParticleSize(
              particleResizeDimensions(data.particle, dimensions),
              allowed,
              data.particle
            )
          )
        }}
        onResizeEnd={(_, dimensions) => {
          if (!active.current) return
          active.current = false
          setPreview(null)
          void controls.finish(id, dimensions).then(() => update(id))
        }}
      >
        <span
          {...surface("handle")}
          aria-hidden
          className="text-muted-foreground flex size-11 items-center justify-center"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M5 23C16 23 23 16 23 5"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </NodeResizeControl>
      {preview && (
        <span
          role="status"
          className="bg-background pointer-events-none absolute right-0 -bottom-8 rounded-full border px-2 py-1 text-xs"
        >
          {PARTICLE_SIZES[preview].label}
        </span>
      )}
    </>
  )
}
