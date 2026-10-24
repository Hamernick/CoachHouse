import type {
  ParticleBatch,
  ParticleCommit,
  ParticleGraph,
  ParticleOperation,
} from "../types"

export type ParticleHistoryDirection = "undo" | "redo"
type Entry = { label: string; operations: ParticleOperation[]; bytes: number }
const MAX_ENTRIES = 50
const MAX_BYTES = 2_000_000

function labelFor(batch: ParticleBatch) {
  const operations = batch.operations
  if (operations.some((item) => item.kind === "move_particles"))
    return operations.some(
      (item) => item.kind === "move_particles" && item.mode === "managed"
    )
      ? "layout"
      : "move"
  if (operations.some((item) => item.kind === "remove_particle"))
    return "deletion"
  if (
    operations.some(
      (item) => item.kind === "put_particle" && item.expectedRevision === null
    )
  )
    return "creation"
  if (operations.some((item) => item.kind === "put_particle")) return "edit"
  return "connection change"
}

// Only called along a revision-fenced local chain. Earlier inverses reference
// older record revisions; intervening local undos have advanced those revisions.
function rebase(
  operations: ParticleOperation[],
  graph: ParticleGraph
): ParticleOperation[] {
  const particles = new Map(
    graph.particles.map((item) => [item.id, item.revision])
  )
  const connections = new Map(
    graph.connections.map((item) => [item.id, item.revision])
  )
  return operations.map((operation) => {
    switch (operation.kind) {
      case "put_particle":
        return {
          ...operation,
          expectedRevision: particles.get(operation.particle.id) ?? null,
        }
      case "remove_particle":
        return {
          ...operation,
          expectedRevision:
            particles.get(operation.id) ?? operation.expectedRevision,
        }
      case "put_connection":
        return {
          ...operation,
          expectedRevision: connections.get(operation.connection.id) ?? null,
        }
      case "remove_connection":
        return {
          ...operation,
          expectedRevision:
            connections.get(operation.id) ?? operation.expectedRevision,
        }
      case "move_particles":
        return {
          ...operation,
          positions: operation.positions.map((item) => ({
            ...item,
            expectedRevision: particles.get(item.id) ?? item.expectedRevision,
          })),
        }
      case "set_root":
        return { ...operation, expectedId: graph.rootId }
    }
  })
}

/** Receipt metadata only; the session graph remains the single source of truth. */
export function createParticleHistory(workspaceId: string) {
  let revision: number | null = null
  let undo: Entry[] = []
  let redo: Entry[] = []
  const reset = (next: number | null) => {
    revision = next
    undo = []
    redo = []
  }
  const observe = (graph: ParticleGraph | null) => {
    if (!graph || graph.workspaceId !== workspaceId) reset(null)
    else if (revision !== graph.revision) reset(graph.revision)
  }
  function trim() {
    const bytes = () =>
      [...undo, ...redo].reduce((sum, entry) => sum + entry.bytes, 0)
    while (undo.length + redo.length > MAX_ENTRIES || bytes() > MAX_BYTES) {
      // Keep the nearest contiguous history; distant redo entries are first.
      if (redo.length) redo.shift()
      else undo.shift()
    }
  }
  return {
    observe,
    snapshot(graph: ParticleGraph | null) {
      observe(graph)
      return {
        undoLabel: undo.at(-1)?.label ?? null,
        redoLabel: redo.at(-1)?.label ?? null,
      }
    },
    prepare(
      direction: ParticleHistoryDirection,
      graph: ParticleGraph,
      id: string
    ): ParticleBatch | null {
      observe(graph)
      const entry = (direction === "undo" ? undo : redo).at(-1)
      return entry
        ? {
            id,
            workspaceId,
            baseRevision: graph.revision,
            requireExactRevision: true,
            operations: rebase(entry.operations, graph),
          }
        : null
    },
    committed(
      batch: ParticleBatch,
      receipt: ParticleCommit,
      direction?: ParticleHistoryDirection
    ) {
      const graph = receipt.graph
      if (
        batch.workspaceId !== workspaceId ||
        graph.workspaceId !== workspaceId
      )
        return
      // A replay confirms persistence but intentionally has no inverse payload.
      // Never invent an undo from an uncertain client snapshot.
      if (receipt.replayed || !receipt.inverse.length) {
        reset(graph.revision)
        return
      }
      const continuous =
        revision === batch.baseRevision &&
        graph.revision === batch.baseRevision + 1
      if (!continuous) reset(graph.revision)
      const source = direction === "undo" ? undo : redo
      const previous = direction && continuous ? source.pop() : undefined
      if (direction && !previous) {
        reset(graph.revision)
        return
      }
      const entry: Entry = {
        label: previous?.label ?? labelFor(batch),
        operations: receipt.inverse,
        bytes: new TextEncoder().encode(JSON.stringify(receipt.inverse))
          .byteLength,
      }
      if (direction === "undo") redo.push(entry)
      else if (direction === "redo") undo.push(entry)
      else {
        undo.push(entry)
        redo = []
      }
      revision = graph.revision
      trim()
    },
  }
}

export function particleHistoryShortcut(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  repeat?: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
}): ParticleHistoryDirection | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.altKey ||
    !(event.metaKey || event.ctrlKey)
  )
    return null
  const key = event.key.toLowerCase()
  if (key === "z") return event.shiftKey ? "redo" : "undo"
  return key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey
    ? "redo"
    : null
}
