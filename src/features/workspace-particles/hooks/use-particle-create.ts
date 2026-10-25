"use client"

import { useCallback, useRef, type RefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"
import type { Particle, ParticlePosition, ParticleType } from "../types"
import { isImagePlaceholder } from "../lib/particle-image"
import type { useParticleSession } from "./use-particle-session"

export function useParticleCreate({
  add,
  count,
  dirty,
  flow,
}: {
  add: ReturnType<typeof useParticleSession>["add"]
  count: number
  dirty: RefObject<boolean>
  flow: RefObject<Pick<ReactFlowInstance, "screenToFlowPosition"> | null>
}) {
  const latest = useRef({ add, count, dirty, flow })
  latest.current = { add, count, dirty, flow }
  return useCallback(
    (
      type: ParticleType,
      title: string,
      prepared?: Particle,
      placement?: { position: ParticlePosition; inspect?: boolean }
    ) => {
      const { add, count, dirty, flow } = latest.current
      if (dirty.current && !window.confirm("Discard unsaved Particle changes?"))
        return Promise.resolve(false)
      const canvas = placement
        ? null
        : document
            .querySelector("[data-workspace-canvas-flow-frame]")
            ?.getBoundingClientRect()
      const position =
        placement?.position ??
        (canvas && flow.current
          ? flow.current.screenToFlowPosition({
              x: canvas.left + canvas.width / 2 - 140,
              y: canvas.top + Math.min(canvas.height * 0.2, 150),
            })
          : { x: 100, y: 100 })
      return add(
        type,
        title,
        placement
          ? position
          : {
              x: position.x + (count % 4) * 28,
              y: position.y + (count % 4) * 28,
            },
        prepared,
        {
          inspect:
            placement?.inspect ?? (!prepared || !isImagePlaceholder(prepared)),
        }
      )
    },
    []
  )
}
