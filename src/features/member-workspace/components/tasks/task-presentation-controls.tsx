"use client"

import { CaretDown, Sliders } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PersonalTaskRelation } from "@/lib/task-tracker"
import type { TaskViewState } from "../../lib/task-view-state"
import { CompletionSelect } from "../shared/completion-select"

const relations = [
  { value: "owned", label: "Assigned to me" },
  { value: "proposed", label: "Proposed to me" },
  { value: "collaborating", label: "Collaborating" },
] as const

export function TaskRelationshipSelect({ value, onChange }: { value: PersonalTaskRelation[]; onChange: (value: PersonalTaskRelation[]) => void }) {
  const label = value.length === 1 ? relations.find(option => option.value === value[0])?.label : value.length ? `${value.length} relationships` : "No relationships"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Task relationship: ${label}`} className="h-11 gap-2 sm:h-8">
          {label}<CaretDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        {relations.map(option => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-accent">
            <Checkbox checked={value.includes(option.value)} onCheckedChange={checked => onChange(checked === true ? [...value, option.value] : value.filter(item => item !== option.value))} />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function TaskPresentationControls({ state, onChange }: { state: TaskViewState; onChange: (patch: Partial<TaskViewState>) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 gap-2 sm:h-8" aria-label="Task display options"><Sliders className="size-4" />Display</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
        <div className="flex items-center justify-between gap-2"><span className="text-sm">Completion</span><CompletionSelect value={state.completion} onChange={completion => onChange({ completion })} /></div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Ordering</span>
          <Select value={state.ordering} onValueChange={ordering => onChange({ ordering: ordering as TaskViewState["ordering"] })}>
            <SelectTrigger aria-label="Task ordering" className="h-11 w-40 sm:h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="due">Due date</SelectItem>
              <SelectItem value="added">Date added</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.ordering !== "manual" && <p className="text-xs text-muted-foreground">{state.ordering === "added" ? "Newest first" : "Earliest due first"} within each project. Undated tasks last.</p>}
      </PopoverContent>
    </Popover>
  )
}
