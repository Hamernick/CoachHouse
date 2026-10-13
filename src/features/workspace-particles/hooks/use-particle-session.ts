"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { readParticleGraph } from "../lib/graph-validation"
import { createParticle } from "../lib/particle-registry"
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
    async (batch: ParticleBatch) => {
      if (inFlight.current || !canEdit) return null
      inFlight.current = true
      setPending(true)
      setError(null)
      setSaved(false)
      retryBatch.current = batch
      try {
        const committed = await transport(batch)
        if (!committed.ok) {
          if (committed.code !== "unavailable") retryBatch.current = null
          setError(committed.error)
          return null
        }
        setResult({ ok: true, value: committed.value.graph })
        current.current = { ok: true, value: committed.value.graph }
        retryBatch.current = null
        setSaved(true)
        return committed.value
      } catch {
        setError("Save interrupted. Retry to confirm your changes.")
        return null
      } finally {
        inFlight.current = false
        setPending(false)
      }
    },
    [canEdit, transport]
  )

  const commit = useCallback(
    (operations: ParticleOperation[]) => {
      const snapshot = current.current
      if (
        !snapshot.ok ||
        snapshot.value.workspaceId !== workspaceId ||
        retryBatch.current ||
        !canEdit
      )
        return Promise.resolve(false)
      return send({
        id: crypto.randomUUID(),
        workspaceId,
        baseRevision: snapshot.value.revision,
        requireExactRevision: false,
        operations,
      }).then(Boolean)
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
    (particle: Particle) =>
      commit([
        { kind: "put_particle", particle, expectedRevision: particle.revision },
      ]),
    [commit]
  )
  const add = useCallback(
    async (
      type: ParticleType,
      title: string,
      position: ParticlePosition,
      prepared?: Particle
    ) => {
      const snapshot = current.current
      if (!snapshot.ok) return false
      if (
        prepared &&
        (prepared.workspaceId !== workspaceId || prepared.type !== type)
      )
        return false
      if (
        prepared &&
        snapshot.value.particles.some((item) => item.id === prepared.id)
      )
        return true
      const retry = retryBatch.current
      if (
        prepared &&
        retry?.operations.some(
          (operation) =>
            operation.kind === "put_particle" &&
            operation.particle.id === prepared.id
        )
      ) {
        const receipt = await send(retry)
        if (receipt) select(prepared.id)
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
      const applied = await commit(operations)
      if (applied) select(particle.id)
      return applied
    },
    [commit, workspaceId, select, send]
  )
  const retry = useCallback(async () => {
    if (retryBatch.current) return send(retryBatch.current).then(Boolean)
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
  return {
    graph: result.ok ? result.value : null,
    error: result.ok ? error : result.error,
    pending,
    saved,
    selectedId,
    select,
    selectionRequest,
    edit,
    add,
    commit,
    getCurrentGraph,
    commitBatch,
    retry,
    editable: canEdit && result.ok && !pending && !error,
  }
}
