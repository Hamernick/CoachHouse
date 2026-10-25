import type { InternalNode } from "@xyflow/react"

type Bounds = InternalNode["internals"]["handleBounds"]
type Handles = NonNullable<Bounds>["source"] | undefined
type Geometry = {
  hidden: boolean
  x: number
  y: number
  width: number | undefined
  height: number | undefined
  bounds: Bounds
}

function sameHandles(a: Handles, b: Handles) {
  if (a?.length !== b?.length) return false
  if (!a || !b) return true
  for (let index = 0; index < a.length; index++) {
    const left = a[index],
      right = b[index]
    if (
      left.id !== right.id ||
      left.position !== right.position ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.width !== right.width ||
      left.height !== right.height
    )
      return false
  }
  return true
}

function sameGeometry(previous: Geometry | undefined, node: InternalNode) {
  return (
    previous &&
    previous.hidden === Boolean(node.hidden) &&
    previous.x === node.internals.positionAbsolute.x &&
    previous.y === node.internals.positionAbsolute.y &&
    previous.width === node.measured.width &&
    previous.height === node.measured.height &&
    Boolean(previous.bounds) === Boolean(node.internals.handleBounds) &&
    sameHandles(previous.bounds?.source, node.internals.handleBounds?.source) &&
    sameHandles(previous.bounds?.target, node.internals.handleBounds?.target)
  )
}

/** Per-observer cache, not application state. React Flow may mutate its lookup
 * and absolute positions in place, so compare geometry values, not map identity.
 * Unrelated store notifications allocate no per-card snapshots or JSON strings.
 */
export function createParticleGeometrySelector() {
  const snapshots = new Map<string, Geometry>()
  let revision = 0
  return ({
    nodeLookup,
  }: {
    nodeLookup: ReadonlyMap<string, InternalNode>
  }) => {
    // Routing follows gesture boundaries; native edges still track every frame.
    for (const node of nodeLookup.values()) if (node.dragging) return -1

    let changed = snapshots.size !== nodeLookup.size
    for (const node of nodeLookup.values()) {
      if (sameGeometry(snapshots.get(node.id), node)) continue
      const bounds = node.internals.handleBounds
      snapshots.set(node.id, {
        hidden: Boolean(node.hidden),
        x: node.internals.positionAbsolute.x,
        y: node.internals.positionAbsolute.y,
        width: node.measured.width,
        height: node.measured.height,
        bounds: bounds
          ? {
              source: bounds.source?.map((handle) => ({ ...handle })) ?? null,
              target: bounds.target?.map((handle) => ({ ...handle })) ?? null,
            }
          : undefined,
      })
      changed = true
    }
    if (snapshots.size !== nodeLookup.size) {
      for (const id of snapshots.keys())
        if (!nodeLookup.has(id)) snapshots.delete(id)
    }
    if (changed) revision++
    return revision
  }
}
