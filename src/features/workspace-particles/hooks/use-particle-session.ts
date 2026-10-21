"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@/lib/toast"
import { notifyNotesChanged } from "@/lib/modules/notes-events"
import { getParticleNotes } from "../lib/particle-notes"
import { particleCreationConflict } from "../lib/particle-event"
import { useParticleCalendarInvalidation } from "./use-particle-calendar-invalidation"
import { applyParticleBatch } from "../lib/graph-operations"
import { readParticleGraph } from "../lib/graph-validation"
import { createParticle } from "../lib/particle-registry"
import {
  createParticleHistory,
  type ParticleHistoryDirection,
} from "../lib/particle-history"
import type {
  Particle,
  ParticleBatch,
  ParticleCommit,
  ParticleGraph,
  ParticleOperation,
  ParticlePosition,
  ParticleResult,
  ParticleType,
} from "../types"

export type ParticleTransport = (
  batch: ParticleBatch
) => Promise<ParticleResult<ParticleCommit>>

export function useParticleSession({
  workspaceId,
  stored,
  canEdit,
  transport,
  load,
}: {
  workspaceId: string
  stored: unknown
  canEdit: boolean
  transport: ParticleTransport
  load: () => Promise<ParticleResult<ParticleGraph>>
}) {
  const initial = useMemo(
    () => readParticleGraph(stored, workspaceId),
    [stored, workspaceId]
  )
  const [result, setResult] = useState(initial)
  const sourceRevision = initial.ok ? initial.value.revision : null
  useParticleCalendarInvalidation(result.ok ? result.value : null)
  const [optimistic, setOptimistic] = useState<ParticleGraph | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectionRequest, setSelectionRequest] = useState(0)
  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setSelectionRequest((value) => value + 1)
  }, [])
  const current = useRef(result)
  const inFlight = useRef(false)
  const retryBatch = useRef<ParticleBatch | null>(null)
  const retryOptimistic = useRef(false)
  const retryDirection = useRef<ParticleHistoryDirection | undefined>(undefined)
  const history = useMemo(
    () => createParticleHistory(workspaceId),
    [workspaceId]
  )
  const historyState = history.snapshot(result.ok ? result.value : null)
  current.current = result
  useEffect(() => {
    if (inFlight.current) return
    setResult((previous) =>
      !previous.ok ||
      !initial.ok ||
      previous.value.workspaceId !== initial.value.workspaceId ||
      initial.value.revision > previous.value.revision
        ? initial
        : previous
    )
  }, [initial, pending])
  const send = useCallback(
    async (
      batch: ParticleBatch,
      direction?: ParticleHistoryDirection,
      optimisticPlacement = false
    ) => {
      if (inFlight.current || !canEdit) return null
      inFlight.current = true
      setPending(true)
      setError(null)
      setSaved(false)
      const retrying = retryBatch.current?.id === batch.id
      const noticeId = `particle-placement:${batch.workspaceId}:${batch.id}`
      retryBatch.current = batch
      retryDirection.current = direction
      retryOptimistic.current = optimisticPlacement
      try {
        if (optimisticPlacement && current.current.ok) {
          const projection = await applyParticleBatch(
            current.current.value,
            batch,
            new Date().toISOString()
          )
          if (!projection.ok) {
            retryBatch.current = null
            setError(projection.error)
            return null
          }
          setOptimistic(projection.value.graph)
        }
        const committed = await transport(batch)
        if (!committed.ok) {
          if (committed.code !== "unavailable") retryBatch.current = null
          setError(committed.error)
          if (optimisticPlacement)
            toast.error("Placement was not saved", {
              id: noticeId,
              description: committed.error,
            })
          return null
        }
        history.committed(batch, committed.value, direction)
        setResult({ ok: true, value: committed.value.graph })
        current.current = { ok: true, value: committed.value.graph }
        retryBatch.current = null
        setSaved(true)
        if (
          batch.operations.some(
            (operation) =>
              operation.kind === "put_particle" &&
              getParticleNotes(operation.particle)?.kind === "workspace"
          )
        )
          notifyNotesChanged()
        if (optimisticPlacement && retrying)
          toast.success("Placement saved", { id: noticeId })
        return committed.value
      } catch {
        setError("Save interrupted. Retry to confirm your changes.")
        if (optimisticPlacement)
          toast.error("Placement was not saved", {
            id: noticeId,
            description: "Save interrupted. Retry to confirm your changes.",
          })
        return null
      } finally {
        inFlight.current = false
        setOptimistic(null)
        setPending(false)
      }
    },
    [canEdit, transport, history]
  )

  const travel = useCallback(
    async (direction: ParticleHistoryDirection) => {
      const snapshot = current.current
      if (!snapshot.ok || !canEdit || inFlight.current || retryBatch.current)
        return false
      const batch = history.prepare(
        direction,
        snapshot.value,
        crypto.randomUUID()
      )
      return batch ? Boolean(await send(batch, direction)) : false
    },
    [canEdit, history, send]
  )

  const commit = useCallback(
    (
      operations: ParticleOperation[],
      options: { optimistic?: boolean } = {}
    ) => {
      const snapshot = current.current
      if (
        !snapshot.ok ||
        snapshot.value.workspaceId !== workspaceId ||
        retryBatch.current ||
        !canEdit
      )
        return Promise.resolve(false)
      return send(
        {
          id: crypto.randomUUID(),
          workspaceId,
          baseRevision: snapshot.value.revision,
          requireExactRevision: false,
          operations,
        },
        undefined,
        options.optimistic === true
      ).then(Boolean)
    },
    [canEdit, send, workspaceId]
  )

  const commitBatch = useCallback(
    async (batch: ParticleBatch) => {
      const snapshot = current.current
      if (
        !snapshot.ok ||
        !canEdit ||
        retryBatch.current ||
        inFlight.current ||
        batch.workspaceId !== workspaceId ||
        snapshot.value.workspaceId !== workspaceId ||
        !batch.requireExactRevision ||
        batch.baseRevision !== snapshot.value.revision
      )
        return null
      return send(batch)
    },
    [canEdit, send, workspaceId]
  )

  const edit = useCallback(
    (particle: Particle, options: { optimistic?: boolean } = {}) =>
      commit(
        [
          {
            kind: "put_particle",
            particle,
            expectedRevision: particle.revision,
          },
        ],
        options
      ),
    [commit]
  )
  const add = useCallback(
    async (
      type: ParticleType,
      title: string,
      position: ParticlePosition,
      prepared?: Particle,
      options: { inspect?: boolean; optimistic?: boolean } = {}
    ) => {
      const snapshot = current.current
      if (!snapshot.ok) return false
      if (
        prepared &&
        (prepared.workspaceId !== workspaceId || prepared.type !== type)
      )
        return false
      const existing = prepared && snapshot.value.particles.find((item) => item.id === prepared.id)
      const retry = retryBatch.current
      const conflict = particleCreationConflict(prepared, existing, retry)
      if (conflict) {
        setError(conflict)
        return false
      }
      if (existing) return true
      if (
        prepared &&
        retry?.operations.some(
          (operation) =>
            operation.kind === "put_particle" &&
            operation.particle.id === prepared.id
        )
      ) {
        const receipt = await send(
          retry,
          undefined,
          options.optimistic !== false
        )
        if (receipt && options.inspect !== false) select(prepared.id)
        return Boolean(receipt)
      }
      const particle = {
        ...(prepared ??
          createParticle(type, {
            id: crypto.randomUUID(),
            workspaceId,
            title,
            now: new Date().toISOString(),
          })),
        position,
        positionMode: "manual" as const,
      }
      const operations: ParticleOperation[] = [
        { kind: "put_particle", particle, expectedRevision: null },
      ]
      if (type === "objective" && snapshot.value.rootId === null)
        operations.push({ kind: "set_root", id: particle.id, expectedId: null })
      const applied = await commit(operations, {
        optimistic: options.optimistic !== false,
      })
      if (applied && options.inspect !== false) select(particle.id)
      return applied
    },
    [commit, workspaceId, select, send]
  )
  const retry = useCallback(async () => {
    if (retryBatch.current)
      return send(
        retryBatch.current,
        retryDirection.current,
        retryOptimistic.current
      ).then(Boolean)
    if (inFlight.current) return false
    inFlight.current = true
    setPending(true)
    try {
      const loaded = await load()
      if (!loaded.ok) {
        setError(loaded.error)
        return false
      }
      if (loaded.value.workspaceId !== workspaceId) {
        setError("Workspace changed. Reload the page.")
        return false
      }
      setResult(loaded)
      setError(null)
      setSaved(false)
      return true
    } catch {
      setError("Unable to refresh. Try again.")
      return false
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [load, send, workspaceId])
  const getCurrentGraph = useCallback(
    () => (current.current.ok ? current.current.value : null),
    []
  )
  return useMemo(
    () => ({
      graph:
        optimistic?.workspaceId === workspaceId
          ? optimistic
          : result.ok
            ? result.value
            : null,
      error: result.ok ? error : result.error,
      pending,
      saved,
      sourceRevision,
      selectedId,
      select,
      selectionRequest,
      edit,
      add,
      commit,
      getCurrentGraph,
      commitBatch,
      travel,
      undoLabel: historyState.undoLabel,
      redoLabel: historyState.redoLabel,
      retry,
      editable: canEdit && result.ok && !pending && !error,
    }),
    [
      result,
      optimistic,
      workspaceId,
      error,
      pending,
      saved,
      sourceRevision,
      selectedId,
      select,
      selectionRequest,
      edit,
      add,
      commit,
      getCurrentGraph,
      commitBatch,
      travel,
      historyState.undoLabel,
      historyState.redoLabel,
      retry,
      canEdit,
    ]
  )
}

export type ParticleSession = ReturnType<typeof useParticleSession>
