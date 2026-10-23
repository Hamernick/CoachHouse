"use client"

import { useCallback, useMemo, useRef, useState, type RefObject } from "react"
import type { Connection, Edge, ReactFlowInstance } from "@xyflow/react"
import { toast } from "@/lib/toast"
import {
  buildParticleInsertion,
  buildParticleLink,
  type ParticleLinkInput,
} from "../lib/connection-editing"
import { particleRegistry } from "../lib/particle-registry"
import type {
  ParticleConnection,
  ParticleGraph,
  ParticleOperation,
  ParticleResult,
} from "../types"
import type { useParticleSession } from "./use-particle-session"

type Input = {
  session: ReturnType<typeof useParticleSession>
  flow: RefObject<ReactFlowInstance | null>
  flush: () => Promise<boolean>
  dirty: RefObject<boolean>
  visibleToolIds: readonly string[]
  blocked: boolean
}

export function useParticleConnections(input: Input) {
  const latest = useRef(input)
  latest.current = input
  const running = useRef(false)
  const [preview, setPreview] = useState<{
    workspaceId: string
    connection: ParticleConnection
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const valid = useCallback((connection: Connection | Edge) => {
    const { session, blocked } = latest.current
    const graph = session.getCurrentGraph()
    return Boolean(
      graph &&
      session.editable &&
      !blocked &&
      buildParticleLink(
        graph,
        connection,
        crypto.randomUUID(),
        latest.current.visibleToolIds
      ).ok
    )
  }, [])
  const perform = useCallback(
    async (
      build: (graph: ParticleGraph) => ParticleResult<ParticleOperation[]>,
      success: string,
      optimistic?: ParticleConnection
    ) => {
      const { session, blocked, dirty, flush } = latest.current
      if (running.current || !session.editable || blocked) return false
      if (dirty.current) {
        setMessage(
          "Save or discard the open Particle edits before changing connections."
        )
        toast.error(
          "Save or discard the open Particle edits before changing connections."
        )
        return false
      }
      running.current = true
      setMessage(null)
      if (optimistic && session.graph)
        setPreview({
          workspaceId: session.graph.workspaceId,
          connection: optimistic,
        })
      try {
        if (
          !(await flush()) ||
          latest.current.blocked ||
          latest.current.dirty.current
        )
          return false
        const graph = latest.current.session.getCurrentGraph()
        if (!graph || graph.workspaceId !== session.graph?.workspaceId)
          return false
        const result = build(graph)
        if (!result.ok) {
          setMessage(result.error)
          toast.error(result.error)
          return false
        }
        const receipt = await latest.current.session.commitBatch({
          id: crypto.randomUUID(),
          workspaceId: graph.workspaceId,
          baseRevision: graph.revision,
          requireExactRevision: true,
          operations: result.value,
        })
        if (!receipt) {
          toast.error(
            "Connection change was not confirmed. Check the save status and retry."
          )
          setMessage(
            "Connection change was not confirmed. Check the save status and retry."
          )
          return false
        }
        const selected = latest.current.session.selectedId
        if (
          selected &&
          !receipt.graph.particles.some((item) => item.id === selected)
        )
          latest.current.session.select(null)
        setMessage(success)
        return true
      } catch {
        toast.error(
          "Unable to change connections. Check the save status and retry."
        )
        setMessage(
          "Unable to change connections. Try again after checking the save status."
        )
        return false
      } finally {
        setPreview(null)
        running.current = false
      }
    },
    []
  )
  const connect = useCallback(
    (connection: ParticleLinkInput) => {
      const graph = latest.current.session.getCurrentGraph()
      if (!graph) return Promise.resolve(false)
      const id = crypto.randomUUID()
      const initial = buildParticleLink(
        graph,
        connection,
        id,
        latest.current.visibleToolIds
      )
      if (!initial.ok) {
        toast.error(initial.error)
        return Promise.resolve(false)
      }
      return perform(
        (current) => {
          const result = buildParticleLink(
            current,
            connection,
            id,
            latest.current.visibleToolIds
          )
          return result.ok
            ? {
                ok: true,
                value: [
                  {
                    kind: "put_connection",
                    connection: result.value,
                    expectedRevision: null,
                  },
                ],
              }
            : result
        },
        "Connection saved.",
        initial.value
      )
    },
    [perform]
  )
  const disconnect = useCallback(
    (id: string, expectedRevision: number) =>
      perform((graph) => {
        const edge = graph.connections.find((item) => item.id === id)
        return edge && edge.revision === expectedRevision
          ? {
              ok: true,
              value: [
                {
                  kind: "remove_connection",
                  id,
                  expectedRevision: edge.revision,
                },
              ],
            }
          : {
              ok: false,
              code: "conflict",
              error: "This connection has already changed. Refresh the plan.",
            }
      }, "Disconnected. You can undo this change."),
    [perform]
  )
  const insert = useCallback(
    (id: string, expectedRevision: number) =>
      perform((graph) => {
        const edge = graph.connections.find((item) => item.id === id)
        if (!edge || edge.revision !== expectedRevision)
          return {
            ok: false,
            code: "conflict",
            error:
              "This connection changed. Review it before inserting a step.",
          }
        const source = graph.particles.find((item) => item.id === edge.source)
        const target = graph.particles.find((item) => item.id === edge?.target)
        if (!source || !target)
          return {
            ok: false,
            code: "invalid",
            error: "This connection is no longer available.",
          }
        const instance = latest.current.flow.current
        const width =
          instance?.getInternalNode(source.id)?.measured.width ??
          particleRegistry[source.type].width
        const sourceHeight =
          instance?.getInternalNode(source.id)?.measured.height ?? 320
        const targetHeight =
          instance?.getInternalNode(target.id)?.measured.height ?? 320
        const gap = target.position.x - source.position.x - width
        const position =
          gap >= 440
            ? {
                x: source.position.x + width + (gap - 280) / 2,
                y: (source.position.y + target.position.y) / 2,
              }
            : {
                x: source.position.x + width + 80,
                y:
                  Math.max(
                    source.position.y + sourceHeight,
                    target.position.y + targetHeight
                  ) + 80,
              }
        return buildParticleInsertion(graph, id, {
          id: crypto.randomUUID(),
          linkId: crypto.randomUUID(),
          type: "activity",
          now: new Date().toISOString(),
          position,
        })
      }, "Resource inserted. Existing positions were preserved."),
    [perform]
  )
  return useMemo(
    () => ({
      preview:
        preview && preview.workspaceId === input.session.graph?.workspaceId
          ? preview.connection
          : null,
      valid,
      connect,
      disconnect,
      insert,
      message,
    }),
    [
      preview,
      input.session.graph?.workspaceId,
      valid,
      connect,
      disconnect,
      insert,
      message,
    ]
  )
}
