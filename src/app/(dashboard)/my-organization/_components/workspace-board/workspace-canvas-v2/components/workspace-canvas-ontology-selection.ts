import type { NodeChange } from "@xyflow/react"

export function applyWorkspaceOntologySelectionChanges({
  selectedIds,
  changes,
}: {
  selectedIds: ReadonlySet<string>
  changes: NodeChange[]
}) {
  const nextSelectedIds = new Set(selectedIds)
  let changed = false
  for (const change of changes) {
    if (change.type !== "select") continue
    changed = true
    if (change.selected) nextSelectedIds.add(change.id)
    else nextSelectedIds.delete(change.id)
  }
  return changed ? nextSelectedIds : selectedIds
}
