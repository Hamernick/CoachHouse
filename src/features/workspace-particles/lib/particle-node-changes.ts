import type { NodeChange } from "reactflow"

export function isWorkspaceParticleNodeId(id: string) {
  return id.startsWith("particle-")
}

export function partitionWorkspaceParticleNodeChanges(changes: NodeChange[]) {
  const particleChanges: NodeChange[] = []
  const workspaceChanges: NodeChange[] = []

  for (const change of changes) {
    if ("id" in change && isWorkspaceParticleNodeId(change.id)) {
      particleChanges.push(change)
    } else {
      workspaceChanges.push(change)
    }
  }

  return { particleChanges, workspaceChanges }
}
