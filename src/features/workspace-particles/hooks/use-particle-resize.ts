"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import { animate } from "motion/react"
import type { Node } from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"
import { particleRegistry } from "../lib/particle-registry"
import {
  particleFamilyDimensions,
  particleResizeDimensions,
  particleSizeStyle,
  resolveParticleResize,
  supportedParticleSizes,
} from "../lib/particle-size"
import type { useParticleSession } from "./use-particle-session"
import type { ParticleCardAction } from "../lib/particle-card-actions"

type Dimensions = { width: number; height: number }
type Input = {
  session: Pick<
    ReturnType<typeof useParticleSession>,
    "getCurrentGraph" | "editable" | "graph"
  >
  dirty: RefObject<boolean>
  blocked: boolean
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
  action: (id: string, action: ParticleCardAction) => Promise<boolean>
}
export function useParticleResize(input: Input) {
  const latest = useRef(input)
  latest.current = input
  const active = useRef<{
    id: string
    revision: number
    start: Dimensions
    last: Dimensions
    workspaceId: string
  } | null>(null)
  const animation = useRef<ReturnType<typeof animate> | null>(null)
  const endAnimation = useRef<(() => void) | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setBusy(false)
    return () => {
      animation.current?.stop()
      active.current = null
      endAnimation.current?.()
    }
  }, [input.session.graph?.workspaceId])
  const begin = useCallback((id: string, dimensions: Dimensions) => {
    const current = latest.current
    const particle = current.session
      .getCurrentGraph()
      ?.particles.find((item) => item.id === id)
    if (
      active.current ||
      current.blocked ||
      current.dirty.current ||
      !current.session.editable ||
      !particle ||
      particle.locked
    )
      return false
    animation.current?.stop()
    active.current = {
      id,
      revision: particle.revision,
      start: dimensions,
      last: dimensions,
      workspaceId: particle.workspaceId,
    }
    setBusy(true)
    return true
  }, [])
  const preview = useCallback((id: string, dimensions: Dimensions) => {
    if (active.current?.id === id) active.current.last = dimensions
  }, [])
  const finish = useCallback(
    async (id: string, dimensions: Dimensions, cancel = false) => {
      const start = active.current
      if (!start || start.id !== id) return
      const current = latest.current
      const particle = current.session
        .getCurrentGraph()
        ?.particles.find((item) => item.id === id)
      const family =
        particle &&
        !cancel &&
        particle.revision === start.revision &&
        !current.dirty.current &&
        !current.blocked
          ? resolveParticleResize(
              start.start,
              dimensions,
              supportedParticleSizes(particle),
              particle
            )
          : null
      if (particle) dimensions = particleResizeDimensions(particle, dimensions)
      const target =
        family && particle
          ? particleFamilyDimensions(particle, family)
          : start.start
      const reduced =
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      const setDimensions = (value: Dimensions) =>
        latest.current.setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  width: value.width,
                  height: value.height,
                  style: { ...node.style, ...value },
                  resizing: false,
                }
              : node
          )
        )
      // One 150ms snap; intermediate React Flow dimensions never enter persistence.
      if (!reduced && !cancel)
        await new Promise<void>((resolve) => {
          endAnimation.current = resolve
          animation.current = animate(0, 1, {
            duration: 0.15,
            ease: "easeOut",
            onUpdate: (progress) =>
              setDimensions({
                width:
                  dimensions.width +
                  (target.width - dimensions.width) * progress,
                height:
                  dimensions.height +
                  (target.height - dimensions.height) * progress,
              }),
            onComplete: resolve,
          })
        })
      else setDimensions(target)
      if (active.current !== start) return
      try {
        const fresh = latest.current.session
          .getCurrentGraph()
          ?.particles.find((item) => item.id === id)
        if (
          family &&
          fresh?.revision === start.revision &&
          fresh.workspaceId === start.workspaceId &&
          fresh.size !== family
        )
          await latest.current.action(id, `family_${family}`)
      } finally {
        const saved = latest.current.session
          .getCurrentGraph()
          ?.particles.find((item) => item.id === id)
        if (saved)
          latest.current.setNodes((nodes) =>
            nodes.map((node) =>
              node.id === id
                ? {
                    ...node,
                    width: undefined,
                    height: undefined,
                    style: particleSizeStyle(
                      saved,
                      particleRegistry[saved.type].width
                    ),
                    resizing: false,
                  }
                : node
            )
          )
        active.current = null
        setBusy(false)
      }
    },
    []
  )
  const isActive = useCallback((id: string) => active.current?.id === id, [])
  return { begin, preview, finish, isActive, busy }
}
