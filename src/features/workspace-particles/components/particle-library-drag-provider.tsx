"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import { useParticleLibraryDropTargets } from "../hooks/use-particle-library-drop-targets"
import {
  PARTICLE_DRAG_MOTION,
  particleDragAnchor,
  particleDragOrigin,
  type ParticleDragPoint,
} from "../lib/particle-drag-gesture"
import {
  ParticleLibraryDragContext,
  particleLibraryDragId,
  notifyParticleLibraryPlacement,
  type ParticleLibraryDragItem,
  type ParticleLibraryDragRequest,
} from "./particle-library-drag-context"

// This overlay renders the existing card element, never a second card design.
type Drag = {
  item: ParticleLibraryDragItem
  source: HTMLElement
  rect: DOMRect
  anchor: ParticleDragPoint
  width: number
  phase: "dragging" | "placing" | "landing"
}
type ParticleLibraryDragProviderProps = {
  children: ReactNode
  canvas: HTMLElement | null
  workspaceId?: string
  enabled?: boolean
  onPlace: (
    request: ParticleLibraryDragRequest,
    position: ParticleDragPoint
  ) => Promise<boolean>
}
export function ParticleLibraryDragProvider({
  children,
  canvas,
  onPlace,
  workspaceId,
  enabled = true,
}: ParticleLibraryDragProviderProps) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [message, setMessage] = useState("")
  const { registerDropTarget, find: findDropTarget, hover: hoverDropTarget, clearHover } = useParticleLibraryDropTargets()
  const current = useRef<Drag | null>(null)
  const latest = useRef({ canvas, onPlace })
  latest.current = { canvas, onPlace }
  const mounted = useRef(true)
  const overlay = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0),
    y = useMotionValue(0)
  const scale = useMotionValue(1),
    rotate = useMotionValue(0),
    opacity = useMotionValue(1)
  const reduced = useReducedMotion()
  const animations = useRef<Array<{ stop: () => void }>>([])
  const originalOpacity = useRef("")
  const stop = useCallback(() => {
    for (const animation of animations.current) animation.stop()
    animations.current = []
  }, [])
  const clear = useCallback(() => {
    stop()
    clearHover()
    const active = current.current
    if (active) active.source.style.opacity = originalOpacity.current
    current.current = null
    if (mounted.current) setDrag(null)
  }, [stop, clearHover])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clear()
    }
  }, [clear])
  const tween = useCallback(
    async (
      target: {
        x?: number
        y?: number
        scale?: number
        rotate?: number
        opacity?: number
      },
      duration: number
    ) => {
      const channels = [
        [x, target.x],
        [y, target.y],
        [scale, target.scale],
        [rotate, target.rotate],
        [opacity, target.opacity],
      ] as const
      const pending = channels.flatMap(([channel, value]) => {
        if (value === undefined) return []
        const animation = animate(channel, value, {
          duration: reduced ? 0 : duration,
          ease: PARTICLE_DRAG_MOTION.ease,
        })
        animations.current.push(animation)
        return [animation]
      })
      await Promise.all(pending)
    },
    [x, y, scale, rotate, opacity, reduced]
  )
  const cancel = useCallback(
    (notice?: string) => {
      const active = current.current
      if (!active || active.phase !== "dragging") return
      stop()
      setMessage(notice ?? `${active.item.title} drag cancelled.`)
      setDrag({ ...active })
      // Return the preview to its slot; persistence keeps its own safe retry state.
      void tween(
        {
          x: active.rect.left,
          y: active.rect.top,
          rotate: 0,
          scale: 1,
          opacity: 0,
        },
        PARTICLE_DRAG_MOTION.cancel
      ).then(() => {
        if (current.current === active) clear()
      })
    },
    [clear, stop, tween]
  )
  const begin = useCallback(
    (
      item: ParticleLibraryDragItem,
      source: HTMLElement,
      point: ParticleDragPoint
    ) => {
      if (current.current || !latest.current.canvas) return false
      const rect = source.getBoundingClientRect()
      if (!rect.width || !rect.height) return false
      stop()
      const width = item.width ?? rect.width
      const anchor = particleDragAnchor(point, rect)
      anchor.x *= width / rect.width
      const active: Drag = {
        item,
        source,
        rect,
        anchor,
        width,
        phase: "dragging",
      }
      current.current = active
      originalOpacity.current = source.style.opacity
      source.style.opacity = "0.35"
      const origin = particleDragOrigin(point, anchor)
      x.set(origin.x)
      y.set(origin.y)
      scale.set(1)
      rotate.set(0)
      opacity.set(1)
      setMessage(
        `Dragging ${item.title}. Drop on the canvas, or press Escape to cancel.`
      )
      setDrag(active)
      if (!reduced)
        void tween(
          { scale: 1.015, rotate: PARTICLE_DRAG_MOTION.tilt },
          PARTICLE_DRAG_MOTION.lift
        )
      return true
    },
    [stop, x, y, scale, rotate, opacity, tween, reduced]
  )
  const move = useCallback(
    (point: ParticleDragPoint) => {
      if (current.current?.phase !== "dragging") return
      const active = current.current
      if (!active) return
      hoverDropTarget(document.elementFromPoint(point.x, point.y))
      // Motion batches DOM writes to its animation frame; no second RAF or state update.
      const origin = particleDragOrigin(point, active.anchor)
      x.set(origin.x)
      y.set(origin.y)
    },
    [x, y, hoverDropTarget]
  )
  const drop = useCallback(
    (point: ParticleDragPoint) => {
      const active = current.current
      const host = latest.current.canvas
      if (!active || active.phase !== "dragging" || !host) return
      const hit = document.elementFromPoint(point.x, point.y)
      const attachmentTarget = findDropTarget(hit)
      if (attachmentTarget) {
        clear()
        void Promise.resolve().then(() => attachmentTarget[1](active.item)).then(ok => {
          if (mounted.current) setMessage(ok ? `${active.item.title} attached.` : `${active.item.title} could not be attached.`)
        }).catch(() => { if (mounted.current) setMessage(`${active.item.title} could not be attached.`) })
        return
      }
      const flow = host.querySelector(".react-flow")
      if (!hit || !flow?.contains(hit)) {
        cancel()
        return
      }
      stop()
      const position = particleDragOrigin(point, active.anchor)
      x.set(position.x)
      y.set(position.y)
      active.phase = "placing"
      setDrag({ ...active })
      setMessage(`Placing ${active.item.title}…`)
      const id = particleLibraryDragId(active.item.request)
      const receipt = { settled: false, ok: false }
      void Promise.resolve()
        .then(() => latest.current.onPlace(active.item.request, position))
        .catch(() => false)
        .then((ok) => {
          receipt.settled = true
          receipt.ok = ok
          notifyParticleLibraryPlacement(
            active.item,
            ok ? "confirmed" : "failed"
          )
          if (
            !mounted.current ||
            (current.current && current.current !== active)
          )
            return
          if (ok) setMessage(`${active.item.title} saved.`)
          else {
            const notice = `Unable to save ${active.item.title}. Its placement was restored. Check the workspace message and retry.`
            if (current.current === active) {
              active.phase = "dragging"
              cancel(notice)
            } else setMessage(notice)
          }
        })
      const settle = async () => {
        let landingNode: HTMLElement | null = null
        let landingOpacity = ""
        try {
          // The existing session publishes its validated optimistic graph first.
          // Hand off immediately; server confirmation is tracked independently.
          const start = performance.now()
          let node: HTMLElement | null = null
          while (
            mounted.current &&
            performance.now() - start < 800 &&
            !(receipt.settled && !receipt.ok)
          ) {
            node = host.querySelector<HTMLElement>(
              `.react-flow__node[data-id="${CSS.escape(id)}"]`
            )
            if (node && node.getBoundingClientRect().width) break
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve())
            )
          }
          if (
            !mounted.current ||
            current.current !== active ||
            (receipt.settled && !receipt.ok)
          )
            return
          if (node && overlay.current) {
            const destination = node.getBoundingClientRect()
            await tween(
              {
                x: destination.left,
                y: destination.top,
                scale: destination.width / active.width,
                rotate: 0,
              },
              PARTICLE_DRAG_MOTION.settle
            )
          }
          if (
            !mounted.current ||
            current.current !== active ||
            (receipt.settled && !receipt.ok)
          )
            return
          // Reveal the real card and dissolve the preview; React Flow retains all
          // position/zoom ownership, including freeform card dragging after landing.
          if (node) {
            landingNode = node
            landingOpacity = node.style.opacity
            node.style.opacity = "0"
            notifyParticleLibraryPlacement(active.item, "placed")
          }
          active.phase = "landing"
          setDrag({ ...active })
          const reveal = node
            ? animate(node, { opacity: 1 }, { duration: reduced ? 0 : 0.1 })
            : Promise.resolve()
          await Promise.all([reveal, tween({ opacity: 0 }, 0.1)])
          if (
            !mounted.current ||
            current.current !== active ||
            (receipt.settled && !receipt.ok)
          )
            return
          setMessage(
            receipt.settled
              ? `${active.item.title} saved.`
              : `${active.item.title} added to canvas. Saving…`
          )
          clear()
        } catch {
          // A visual handoff error must not replay or undo a persistence request.
          if (mounted.current && current.current === active) clear()
        } finally {
          if (landingNode) landingNode.style.opacity = landingOpacity
        }
      }
      void settle()
    },
    [cancel, stop, x, y, tween, clear, reduced, findDropTarget]
  )
  const controller = useMemo(
    () => ({
      begin,
      move,
      drop,
      cancel,
      workspaceId,
      enabled,
      registerDropTarget,
      place: async (request: ParticleLibraryDragRequest) => {
        const host = latest.current.canvas
        if (!enabled || !host) return false
        const rect = host.getBoundingClientRect()
        return latest.current.onPlace(request, {
          x: rect.left + rect.width / 2 - 200,
          y: rect.top + 80,
        })
      },
    }),
    [begin, move, drop, cancel, workspaceId, enabled, registerDropTarget]
  )
  return (
    <ParticleLibraryDragContext.Provider value={controller}>
      {children}
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      {drag &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {drag.phase === "placing" && (
              <style>{`[data-workspace-canvas-flow-frame] .react-flow__node[data-id="${CSS.escape(particleLibraryDragId(drag.item.request))}"]{visibility:hidden!important}`}</style>
            )}
            <motion.div
              ref={overlay}
              aria-hidden
              inert
              data-particle-library-drag-preview="true"
              className="pointer-events-none fixed top-0 left-0 z-[100] select-none"
              style={{
                x,
                y,
                scale,
                rotate,
                opacity,
                width: drag.width,
                transformOrigin: "0 0",
                willChange: "transform, opacity",
              }}
            >
              <div className="pointer-events-none [&_*]:pointer-events-none">
                {drag.item.preview}
              </div>
              {drag.phase === "placing" && (
                <span className="bg-card text-muted-foreground absolute right-0 -bottom-7 rounded-full px-2 py-1 text-xs">
                  Placing…
                </span>
              )}
            </motion.div>
          </>,
          document.body
        )}
    </ParticleLibraryDragContext.Provider>
  )
}
