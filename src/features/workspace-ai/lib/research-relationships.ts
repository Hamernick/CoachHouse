import type { ResearchResult } from "../research-types"

/** Shared preview/server topology rules; authorization remains server-side. */
export function validateResearchRelationships(result: Pick<ResearchResult, "items" | "decisions">) {
  const items = new Map(result.items.map(item => [item.key, item]))
  const branches: { source: string; target: string }[] = []
  for (const item of result.items) {
    if (item.dependsOn.some(key => key === item.key || !items.has(key)) || new Set(item.dependsOn).size !== item.dependsOn.length)
      throw new Error("Choose distinct prerequisites from this preview, excluding the item itself.")
  }
  for (const decision of result.decisions ?? []) {
    if (!items.has(decision.itemKey)) throw new Error("Decision references an unavailable item.")
    for (const outcome of decision.outcomes) {
      if (new Set(outcome.next).size !== outcome.next.length || outcome.next.some(key => !items.has(key) || key === decision.itemKey))
        throw new Error("Invalid decision branch.")
      for (const target of outcome.next) {
        if (items.get(target)!.dependsOn.includes(decision.itemKey)) throw new Error("A branch cannot also be an unconditional dependency.")
        branches.push({ source: decision.itemKey, target })
      }
    }
  }
  if (branches.length + result.items.reduce((count, item) => count + item.dependsOn.length, 0) > 60)
    throw new Error("Research has too many relationships.")
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error("These prerequisites create a cycle. Remove a connection to continue.")
    if (visited.has(key)) return
    visiting.add(key)
    items.get(key)!.dependsOn.forEach(visit)
    branches.filter(branch => branch.target === key).forEach(branch => visit(branch.source))
    visiting.delete(key); visited.add(key)
  }
  result.items.forEach(item => visit(item.key))
}
