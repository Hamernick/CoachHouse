import { format, isValid, parseISO, startOfWeek } from "date-fns"
import type { PersonalTaskRelation } from "@/lib/task-tracker"
import type { FilterChip } from "@/features/platform-admin-dashboard"

export type TaskViewState = {
  view: "list" | "board"
  relation: PersonalTaskRelation
  week: string
  weekend: boolean
  filters: FilterChip[]
}

const keys = ["taskView", "taskRelation", "taskWeek", "taskWeekend", "taskFilters"]

function validFilters(value: unknown): FilterChip[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).filter((chip): chip is FilterChip => {
    if (!chip || typeof chip.key !== "string" || typeof chip.value !== "string") return false
    if (chip.value.length > 120 || !chip.value.trim()) return false
    const key = chip.key.toLowerCase()
    if (!/^(status|priority|tags?|members?|pic)$/.test(key)) return false
    // The production picker supplies actual people, never the lab's fixture aliases.
    if ((key.startsWith("member") || key === "pic") && ["current", "current member"].includes(chip.value.toLowerCase())) return false
    return true
  })
}

export function readTaskViewState(params: URLSearchParams, today = new Date()): TaskViewState {
  const rawWeek = params.get("taskWeek") ?? ""
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawWeek) ? parseISO(rawWeek) : today
  const relation = params.get("taskRelation")
  let filters: FilterChip[] = []
  try { filters = validFilters(JSON.parse(params.get("taskFilters") ?? "[]")) } catch { /* Invalid URL state is ignored. */ }
  return {
    view: params.get("taskView") === "board" ? "board" : "list",
    relation: relation === "proposed" || relation === "collaborating" ? relation : "owned",
    week: format(startOfWeek(isValid(parsed) ? parsed : today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    weekend: params.get("taskWeekend") === "1",
    filters,
  }
}

export function writeTaskViewState(params: URLSearchParams, state: TaskViewState): URLSearchParams {
  const next = new URLSearchParams(params)
  keys.forEach(key => next.delete(key))
  if (state.view !== "list") next.set("taskView", state.view)
  if (state.relation !== "owned") next.set("taskRelation", state.relation)
  next.set("taskWeek", state.week)
  if (state.weekend) next.set("taskWeekend", "1")
  if (state.filters.length) next.set("taskFilters", JSON.stringify(validFilters(state.filters)))
  return next
}
