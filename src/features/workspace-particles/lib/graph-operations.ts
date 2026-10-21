import { getParticleNotes } from "./particle-notes"
import { isWorkspaceToolId } from "./workspace-tool-contract"
import type {
  Particle,
  ParticleBatch,
  ParticleCommit,
  ParticleConnection,
  ParticleGraph,
  ParticleOperation,
  ParticleResult,
} from "../types"
import { readParticleGraph, validateParticleGraph } from "./graph-validation"
import {
  fingerprintParticleBatch,
  particleBatchSchema,
} from "./operation-schema"
import { particleGraphSchema } from "./particle-schema"

export type PreparedParticleBatch = {
  batch: ParticleBatch
  fingerprint: string
}
export async function prepareParticleBatch(
  input: unknown
): Promise<ParticleResult<PreparedParticleBatch>> {
  try {
    // Check serialized size before traversing a potentially large object schema.
    await fingerprintParticleBatch(input)
    const parsed = particleBatchSchema.safeParse(input)
    if (!parsed.success)
      return {
        ok: false,
        code: "invalid",
        error: "Invalid Particle operation.",
      }
    return {
      ok: true,
      value: {
        batch: parsed.data,
        fingerprint: await fingerprintParticleBatch(parsed.data),
      },
    }
  } catch {
    return {
      ok: false,
      code: "invalid",
      error:
        "Particle operation is not serializable or exceeds its size limit.",
    }
  }
}

function inverseOperations(
  before: ParticleGraph,
  after: ParticleGraph
): ParticleOperation[] {
  const inverse: ParticleOperation[] = []
  const oldParticles = new Map(before.particles.map((item) => [item.id, item]))
  const newParticles = new Map(after.particles.map((item) => [item.id, item]))
  const oldEdges = new Map(before.connections.map((item) => [item.id, item]))
  const newEdges = new Map(after.connections.map((item) => [item.id, item]))
  for (const item of before.particles) {
    const current = newParticles.get(item.id)
    if (!current || current.revision !== item.revision)
      inverse.push({
        kind: "put_particle",
        particle: item,
        expectedRevision: current?.revision ?? null,
      })
  }
  for (const item of after.particles) {
    if (!oldParticles.has(item.id))
      inverse.push({
        kind: "remove_particle",
        id: item.id,
        expectedRevision: item.revision,
      })
  }
  for (const item of before.connections) {
    const current = newEdges.get(item.id)
    if (!current || current.revision !== item.revision)
      inverse.push({
        kind: "put_connection",
        connection: item,
        expectedRevision: current?.revision ?? null,
      })
  }
  for (const item of after.connections) {
    // Removing a newly created Particle already cleans its incident edges.
    if (
      !oldEdges.has(item.id) &&
      (oldParticles.has(item.source) || isWorkspaceToolId(item.source)) &&
      (oldParticles.has(item.target) || isWorkspaceToolId(item.target))
    )
      inverse.push({
        kind: "remove_connection",
        id: item.id,
        expectedRevision: item.revision,
      })
  }
  if (before.rootId !== after.rootId)
    inverse.push({ kind: "set_root", expectedId: null, id: before.rootId })
  // Explicit root comparison runs against the pre-operation graph, not the draft.
  const root = inverse.find((item) => item.kind === "set_root")
  if (root?.kind === "set_root") root.expectedId = after.rootId
  return inverse
}

export function applyPreparedParticleBatch(
  current: ParticleGraph,
  prepared: PreparedParticleBatch,
  now: string
): ParticleResult<ParticleCommit> {
  const { batch, fingerprint } = prepared
  if (batch.workspaceId !== current.workspaceId)
    return {
      ok: false,
      code: "scope",
      error: "Particle operation belongs to another workspace.",
    }
  const valid = readParticleGraph(current, current.workspaceId)
  if (!valid.ok) return valid
  const receipt = current.receipts.find((item) => item.id === batch.id)
  if (receipt)
    return receipt.fingerprint === fingerprint
      ? { ok: true, value: { graph: current, inverse: [], replayed: true } }
      : {
          ok: false,
          code: "conflict",
          error: "This operation ID was already used for a different change.",
        }
  if (
    batch.baseRevision < current.minimumBaseRevision ||
    batch.baseRevision > current.revision ||
    (batch.requireExactRevision && batch.baseRevision !== current.revision)
  )
    return {
      ok: false,
      code: "conflict",
      error: "Workspace changed. Refresh this operation before applying it.",
    }
  const revision = current.revision + 1
  const particles = new Map(current.particles.map((item) => [item.id, item]))
  const connections = new Map(
    current.connections.map((item) => [item.id, item])
  )
  const touched = new Set<string>()
  let rootId = current.rootId
  const conflict = (): ParticleResult<ParticleCommit> => ({
    ok: false,
    code: "conflict",
    error: "A selected record changed. Refresh before applying this operation.",
  })
  function claim(
    kind: "particle" | "connection",
    id: string,
    expected: number | null
  ) {
    // Preconditions refer to the original snapshot, including when an earlier
    // deletion in this batch cleaned an edge that an inverse operation restores.
    const entity =
      kind === "particle"
        ? current.particles.find((item) => item.id === id)
        : current.connections.find((item) => item.id === id)
    const key = `${kind}:${id}`
    if (touched.has(key) || (entity?.revision ?? null) !== expected)
      return false
    touched.add(key)
    return true
  }
  function moved(before: Particle, after: Particle) {
    return (
      before.position.x !== after.position.x ||
      before.position.y !== after.position.y ||
      before.width !== after.width
    )
  }
  for (const operation of batch.operations) {
    switch (operation.kind) {
      case "put_particle": {
        let item = operation.particle
        const existing = particles.get(item.id)
        if (item.workspaceId !== current.workspaceId)
          return {
            ok: false,
            code: "scope",
            error: "Particle belongs to another workspace.",
          }
        if (!claim("particle", item.id, operation.expectedRevision))
          return conflict()
        if (existing && existing.type !== item.type)
          return {
            ok: false,
            code: "invalid",
            error: "Particle type cannot be changed in place.",
          }
        if (
          existing &&
          (existing.locked || item.locked) &&
          moved(existing, item)
        )
          return {
            ok: false,
            code: "locked",
            error: "Unlock the Particle before moving or resizing it.",
          }
        const note = getParticleNotes(item)
        const previousNote = existing && getParticleNotes(existing)
        if (item.type === "activity" && note?.kind === "workspace") {
          const changed = previousNote?.kind !== "workspace" || note.content !== previousNote.content || note.html !== previousNote.html
          item = { ...item, data: { ...item.data, widget: { kind: "notes", source: {
            ...note, contentEditedAt: changed ? now : previousNote.contentEditedAt ?? existing?.updatedAt ?? now,
          } } } }
        }
        particles.set(item.id, {
          ...item,
          revision,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
        break
      }
      case "remove_particle": {
        if (!claim("particle", operation.id, operation.expectedRevision))
          return conflict()
        for (const edge of connections.values()) {
          if (edge.source !== operation.id && edge.target !== operation.id)
            continue
          if (edge.revision > batch.baseRevision && edge.revision !== revision)
            return conflict()
          connections.delete(edge.id)
        }
        particles.delete(operation.id)
        if (rootId === operation.id) rootId = null
        break
      }
      case "put_connection": {
        const item = operation.connection
        if (!claim("connection", item.id, operation.expectedRevision))
          return conflict()
        connections.set(item.id, { ...item, revision })
        break
      }
      case "remove_connection": {
        if (!claim("connection", operation.id, operation.expectedRevision))
          return conflict()
        connections.delete(operation.id)
        break
      }
      case "move_particles": {
        if (operation.mode === "managed" && !batch.requireExactRevision)
          return {
            ok: false,
            code: "invalid",
            error: "Auto-layout requires an exact graph revision.",
          }
        for (const move of operation.positions) {
          const existing = particles.get(move.id)
          if (!existing || !claim("particle", move.id, move.expectedRevision))
            return conflict()
          if (existing.locked)
            return {
              ok: false,
              code: "locked",
              error: "Unlock selected Particles before moving them.",
            }
          const note = getParticleNotes(existing)
          const stationaryNote = existing.type === "activity" && note?.kind === "workspace"
            ? { ...existing, data: { ...existing.data, widget: { kind: "notes" as const, source: { ...note, contentEditedAt: note.contentEditedAt ?? existing.updatedAt } } } }
            : existing
          particles.set(move.id, {
            ...stationaryNote,
            position: move.position,
            positionMode: operation.mode,
            revision,
            updatedAt: now,
          })
        }
        break
      }
      case "set_root": {
        if (
          batch.baseRevision !== current.revision ||
          current.rootId !== operation.expectedId ||
          touched.has("root")
        )
          return conflict()
        touched.add("root")
        rootId = operation.id
        break
      }
    }
  }
  const receipts = [
    ...current.receipts,
    { id: batch.id, fingerprint, revision },
  ]
  const removedReceipt = receipts.length > 64 ? receipts.shift() : undefined
  const graph: ParticleGraph = {
    ...current,
    rootId,
    revision,
    particles: [...particles.values()],
    connections: [...connections.values()],
    receipts,
    minimumBaseRevision:
      removedReceipt?.revision ?? current.minimumBaseRevision,
  }
  const parsed = particleGraphSchema.safeParse(graph)
  if (
    !parsed.success ||
    new TextEncoder().encode(JSON.stringify(graph)).byteLength > 2_000_000
  )
    return {
      ok: false,
      code: "invalid",
      error: "Result exceeds Particle limits or contains invalid values.",
    }
  const error = validateParticleGraph(graph)
  if (error) return { ok: false, code: "invalid", error }
  const inverse = inverseOperations(current, graph)
  // A committed operation must remain undoable through the same bounded API.
  const inverseBytes = new TextEncoder().encode(
    JSON.stringify({ ...batch, baseRevision: revision, operations: inverse })
  ).byteLength
  if (inverseBytes > 512_000 || inverse.length > 1000)
    return {
      ok: false,
      code: "invalid",
      error:
        "This change is too large to undo safely. Use a smaller selection.",
    }
  return { ok: true, value: { graph, inverse, replayed: false } }
}

export async function applyParticleBatch(
  graph: ParticleGraph,
  input: unknown,
  now: string
): Promise<ParticleResult<ParticleCommit>> {
  const prepared = await prepareParticleBatch(input)
  return prepared.ok
    ? applyPreparedParticleBatch(graph, prepared.value, now)
    : prepared
}

export function isDecisionBranchActive(
  graph: ParticleGraph,
  edge: ParticleConnection
) {
  const source = graph.particles.find((item) => item.id === edge.source)
  return (
    edge.relationship === "decision_outcome" &&
    source?.type === "decision" &&
    source.data.selectedOutcome === edge.outcome
  )
}
