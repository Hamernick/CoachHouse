import { format, isValid, parseISO, startOfWeek } from "date-fns"
import type { PersonalTaskRelation } from "@/lib/task-tracker"
import type { FilterChip } from "@/features/platform-admin-dashboard"

export type TaskViewState = {
  view: "list" | "board"
  relation: PersonalTaskRelation[]
  completion: "all" | "completed" | "incomplete"
  ordering: "manual" | "added" | "due"
  week: string
  weekend: boolean
  filters: FilterChip[]
}

const keys = ["taskView", "taskRelation", "taskWeek", "taskWeekend", "taskFilters", "taskCompletion", "taskOrder"]

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
  const rawRelation = params.get("taskRelation")
  const relations = (rawRelation ?? "owned").split(",").filter((value): value is PersonalTaskRelation => ["owned", "proposed", "collaborating"].includes(value))
  const completion = params.get("taskCompletion")
  const ordering = params.get("taskOrder")
  let filters: FilterChip[] = []
  try { filters = validFilters(JSON.parse(params.get("taskFilters") ?? "[]")) } catch { /* Invalid URL state is ignored. */ }
  return {
    view: params.get("taskView") === "board" ? "board" : "list",
    relation: rawRelation === "none" ? [] : relations.length ? Array.from(new Set(relations)) : ["owned"],
    completion: completion === "completed" || completion === "incomplete" ? completion : "all",
    ordering: ordering === "added" || ordering === "due" ? ordering : "manual",
    week: format(startOfWeek(isValid(parsed) ? parsed : today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    weekend: params.get("taskWeekend") === "1",
    filters,
  }
}

export function writeTaskViewState(params: URLSearchParams, state: TaskViewState): URLSearchParams {
  const next = new URLSearchParams(params)
  keys.forEach(key => next.delete(key))
  if (state.view !== "list") next.set("taskView", state.view)
  if (state.relation.length !== 1 || state.relation[0] !== "owned") next.set("taskRelation", state.relation.join(",") || "none")
  if (state.completion !== "all") next.set("taskCompletion", state.completion)
  if (state.ordering !== "manual") next.set("taskOrder", state.ordering)
  next.set("taskWeek", state.week)
  if (state.weekend) next.set("taskWeekend", "1")
  if (state.filters.length) next.set("taskFilters", JSON.stringify(validFilters(state.filters)))
  return next
}
