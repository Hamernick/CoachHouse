import type { MemberWorkspaceWorkstreamCategory } from "../types"

export const DEFAULT_WORKSTREAM_CATEGORIES = [
  { default_key: "backlog", name: "Intake", color: "slate", position: 0 },
  { default_key: "planned", name: "In progress", color: "blue", position: 1 },
  { default_key: "waiting_on_organization", name: "Waiting", color: "amber", position: 2 },
  { default_key: "completed", name: "Complete", color: "emerald", position: 3 },
] as const

// Project older defaults into the smaller workflow without rewriting saved rows.
export function simplifyWorkstreamCategories(input: MemberWorkspaceWorkstreamCategory[]) {
  const aliases = new Map<string, string>()
  const progress = input.find((category) => category.defaultKey === "planned" && ["Coach Action", "In progress"].includes(category.name))
  const categories = input.flatMap((category) => {
    if (progress && (
      (category.defaultKey === "active" && category.name === "Ongoing Support") ||
      (category.defaultKey === "review_approval" && category.name === "Review & Approval")
    )) {
      aliases.set(category.id, progress.id)
      return []
    }
    const current = DEFAULT_WORKSTREAM_CATEGORIES.find((item) => item.default_key === category.defaultKey)
    const legacyNames: Record<string, string> = { backlog: "New Intake", planned: "Coach Action", waiting_on_organization: "Waiting on Organization", completed: "Complete" }
    const originalNames = [legacyNames[category.defaultKey ?? ""], current?.name]
    return [{ ...category, ...(current && originalNames.includes(category.name) ? {
      name: current.name, color: current.color, position: current.position,
    } : {}) }]
  }).sort((left, right) => left.position - right.position)
  return { categories, aliases }
}
