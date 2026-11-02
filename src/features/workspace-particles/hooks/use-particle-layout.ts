"use client"

import { particleArrangementIds } from "../lib/particle-creation-placement"

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import { toast } from "@/lib/toast"
import { animate } from "motion/react"
import type { Node, ReactFlowInstance } from "@xyflow/react"
import { WORKSPACE_CANVAS_PARTICLE_LAYOUT_MOTION } from "@/lib/workspace-canvas/motion-spec"
import type { ParticleNodeData } from "../components/particle-node"
import { captureParticleScene } from "../lib/layout-measurements"
import { particleLayoutBatch, type ParticleLayout } from "../lib/graph-layout"
import { particleSceneKey } from "../lib/layout-scene"
import { runParticleWorker } from "../lib/layout-worker-client"
import type { useParticleSession } from "./use-particle-session"

type Phase = "idle" | "measuring" | "calculating" | "saving" | "animating"
type Session = ReturnType<typeof useParticleSession>
type Input = {
  session: Session
  flow: RefObject<ReactFlowInstance | null>
  flush: () => Promise<boolean>
  dirty: RefObject<boolean>
  setNodes: Dispatch<SetStateAction<Node<ParticleNodeData>[]>>
}
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 50))

export function useParticleLayout({
  session,
  flow,
  flush,
  dirty,
  setNodes,
}: Input) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [geometry, geometryChanged] = useReducer(
    (value: number) => value + 1,
    0
  )
  const [routes, setRoutes] = useState<ParticleLayout["routes"]>([])
  const routeCache = useRef<{
    key: string
    routes: ParticleLayout["routes"]
  } | null>(null)
  // New manual links keep their native rounded path until deliberate Auto-layout.
  // A background routing pass must not restyle a just-dropped connection.
  const routedIds = useRef<{ workspaceId: string; ids: Set<string> } | null>(
    null
  )
  const active = useRef<AbortController | null>(null)
  const saving = useRef(false)
  const latest = useRef({ session, flow, flush, dirty, setNodes })
  latest.current = { session, flow, flush, dirty, setNodes }
  const cancel = useCallback(() => {
    if (!saving.current) active.current?.abort()
  }, [])
  useEffect(() => () => active.current?.abort(), [session.graph?.workspaceId])

  // Routing follows persisted/manual geometry; it never invokes ELK or moves cards.
  useEffect(() => {
    if (phase !== "idle") {
      setRoutes(current => current.length ? [] : current)
      return
    }
    if (!session.graph || !flow.current) return
    if (routedIds.current?.workspaceId !== session.graph.workspaceId)
      routedIds.current = {
        workspaceId: session.graph.workspaceId,
        ids: new Set(session.graph.connections.map((edge) => edge.id)),
      }
    const captured = captureParticleScene(session.graph, flow.current)
    // Background routing must not mount every offscreen card. Native edges
    // remain available; deliberate layout mounts the full scene for measurement.
    if (!captured.ok) return
    setRoutes(current => current.length ? [] : current)
    if (!captured.value.graph.connections.length) return
    const controller = new AbortController()
    const key = particleSceneKey(captured.value)
    if (routeCache.current?.key === key) {
      setRoutes(routeCache.current.routes)
      return
    }
    const timer = setTimeout(() => {
      void runParticleWorker(
        {
          kind: "route",
          scene: {
            ...captured.value,
            graph: {
              ...captured.value.graph,
              connections: captured.value.graph.connections.filter((edge) =>
                routedIds.current?.ids.has(edge.id)
              ),
            },
          },
        },
        controller.signal
      ).then((result) => {
        const current = latest.current.session.getCurrentGraph()
        const instance = latest.current.flow.current
        if (controller.signal.aborted || !current || !instance) return
        const now = captureParticleScene(current, instance)
        if (result.ok && now.ok && particleSceneKey(now.value) === key)
          setRoutes(result.value)
      })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [geometry, phase, session.graph, flow])

  const run = useCallback(async (selectionOnly = false, requestedIds?: readonly string[]) => {
    const input = latest.current
    if (!input.session.editable || active.current) return
    if (input.dirty.current) {
      setMessage("Save or discard the open Particle edits before arranging.")
      return
    }
    const workspaceId = input.session.getCurrentGraph()?.workspaceId
    const canvas = input.flow.current
    if (!workspaceId || !canvas) return
    const sameCanvas = () => latest.current.flow.current === canvas &&
      latest.current.session.getCurrentGraph()?.workspaceId === workspaceId
    const controller = new AbortController()
    let saved = false
    let superseded = false
    active.current = controller
    setMessage(null)
    setPhase("measuring")
    try {
      if (!(await input.flush()))
        throw new Error("Save pending moves before arranging.")
      let stable = false
      let previousKey: string | null = null
      let scene: ReturnType<typeof captureParticleScene> | null = null
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await delay()
        if (controller.signal.aborted) return
        if (!sameCanvas()) { controller.abort(); return }
        const graph = latest.current.session.getCurrentGraph()
        const instance = input.flow.current
        if (!graph || !instance) throw new Error("Workspace is unavailable.")
        scene = captureParticleScene(graph, instance)
        if (scene.ok) {
          const key = particleSceneKey(scene.value)
          if (key === previousKey) {
            stable = true
            break
          }
          previousKey = key
        }
      }
      if (!scene?.ok)
        throw new Error(
          scene && !scene.ok
            ? scene.error
            : "Cards are not measured yet. Try again."
        )
      if (!stable)
        throw new Error(
          "Card sizes are still changing. Try again when content has loaded."
        )
      const captured = scene.value
      const selected = new Set(
        input.flow.current
          ?.getNodes()
          .filter((node) => node.selected)
          .map((node) => node.id)
      )
      const scopeIds = particleArrangementIds(captured.graph, selectionOnly ? selected : undefined, requestedIds)
      if (!scopeIds.length)
        throw new Error("No automatically placed plan cards to arrange. Select unlocked cards to arrange them explicitly.")
      setPhase("calculating")
      const result = await runParticleWorker(
        { kind: "layout", scene: captured, scopeIds },
        controller.signal
      )
      if (controller.signal.aborted) return
      if (!result.ok) throw new Error(result.error)
      const graph = latest.current.session.getCurrentGraph()
      const instance = input.flow.current
      if (!sameCanvas() || !graph || !instance) throw new Error("Workspace changed. Try again.")
      const current = captureParticleScene(graph, instance)
      if (
        !current.ok ||
        particleSceneKey(current.value) !== particleSceneKey(captured)
      )
        throw new Error("The canvas changed while arranging. Try again.")
      const batch = particleLayoutBatch(
        graph,
        current.value.measurements,
        result.value,
        crypto.randomUUID(),
        scopeIds
      )
      if (!batch.ok) throw new Error(batch.error)
      setPhase("saving")
      saving.current = true
      const receipt = await latest.current.session.commitBatch(batch.value)
      saving.current = false
      saved = Boolean(receipt)
      if (controller.signal.aborted) return
      if (!receipt)
        throw new Error(
          "Layout was not confirmed. Check the save status before trying again."
        )
      // A confirmed write owns only this revision and this canvas. A newer
      // snapshot or local gesture wins, including while React queues an updater.
      const isCurrent = () => !controller.signal.aborted && sameCanvas() &&
        latest.current.session.getCurrentGraph()?.revision === receipt.graph.revision &&
        !canvas.getNodes().some(node => node.dragging || node.resizing)
      const continueAnimation = () => {
        if (isCurrent()) return true
        superseded ||= !controller.signal.aborted
        controller.abort()
        return false
      }
      if (!continueAnimation()) return
      setPhase("animating")
      const starts = new Map(
        instance.getNodes().map((node) => [node.id, node.position])
      )
      const targets = new Map(result.value.nodes.map((node) => [node.id, node]))
      const apply = (progress: number) => {
        if (!continueAnimation()) return
        input.setNodes((nodes) => {
          if (!isCurrent() || nodes.some(node => node.dragging || node.resizing)) return nodes
          return nodes.map((node) => {
            const target = targets.get(node.id),
              start = starts.get(node.id)
            return target && start
              ? {
                  ...node,
                  position: {
                    x: start.x + (target.x - start.x) * progress,
                    y: start.y + (target.y - start.y) * progress,
                  },
                }
              : node
          })
        })
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        apply(1)
      else
        await new Promise<void>((resolve) => {
          const animation = animate(0, 1, {
            ...WORKSPACE_CANVAS_PARTICLE_LAYOUT_MOTION,
            onUpdate: apply,
            onComplete: finish,
          })
          function finish() {
            controller.signal.removeEventListener("abort", stop)
            resolve()
          }
          function stop() {
            animation.stop()
            finish()
          }
          controller.signal.addEventListener("abort", stop, { once: true })
          if (controller.signal.aborted) stop()
        })
      if (continueAnimation()) {
        routedIds.current = {
          workspaceId: receipt.graph.workspaceId,
          ids: new Set(receipt.graph.connections.map((edge) => edge.id)),
        }
        routeCache.current = {
          key: particleSceneKey({ ...captured, graph: receipt.graph }),
          routes: result.value.routes,
        }
        apply(1)
        setMessage(`Arranged ${scopeIds.length} Particles.`)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const detail =
          error instanceof Error
            ? error.message
            : "Unable to arrange this plan."
        setMessage(detail)
        toast.error(detail)
      }
    } finally {
      saving.current = false
      if (active.current === controller) {
        active.current = null
        setPhase("idle")
        if (controller.signal.aborted) setMessage(saved
          ? superseded ? "Layout saved; newer changes preserved." : "Layout saved; animation stopped."
          : "Layout cancelled.")
      }
    }
  }, [])

  return useMemo(
    () => ({
      measureAll: phase !== "idle",
      busy: phase !== "idle",
      phase,
      message,
      routes,
      run,
      cancel,
      geometryChanged,
    }),
    [phase, message, routes, run, cancel, geometryChanged]
  )
}
