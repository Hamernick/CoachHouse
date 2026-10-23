"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Completion = "all" | "completed" | "incomplete"

export function CompletionSelect({ value, onChange }: { value: Completion; onChange: (value: Completion) => void }) {
  return (
    <Select value={value} onValueChange={value => onChange(value as Completion)}>
      <SelectTrigger aria-label="Completion" className="h-11 w-40 sm:h-8"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="incomplete">Not completed</SelectItem>
      </SelectContent>
    </Select>
  )
}
