import type { Node, NodeChange } from "@xyflow/react"
import type { ParticleNodeData } from "../components/particle-node"

/** Domain records come from the session; viewport replacements may only select. */
export function particleFlowStateChanges(
  changes: readonly NodeChange[]
): NodeChange<Node<ParticleNodeData>>[] {
  return changes.flatMap((change): NodeChange<Node<ParticleNodeData>>[] => {
    if (change.type === "add" || change.type === "remove") return []
    if (change.type === "replace")
      return [
        {
          type: "select",
          id: change.id,
          selected: change.item.selected ?? false,
        },
      ]
    return [change]
  })
}
