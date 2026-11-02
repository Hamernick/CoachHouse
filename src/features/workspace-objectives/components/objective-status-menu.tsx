"use client"

import { Check } from "lucide-react"
import { DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"

const statuses = [
  { value: "backlog", label: "Not started", tone: "var(--muted-foreground)" },
  { value: "in_progress", label: "In progress", tone: "var(--planning-active)" },
  { value: "blocked", label: "Blocked", tone: "var(--planning-blocked)" },
  { value: "done", label: "Complete", tone: "var(--planning-complete)" },
] as const

type ObjectiveStatus = typeof statuses[number]["value"]

export function ObjectiveStatusMenu({ value, disabled, onChange, completionLabel = "Confirm outcome" }: {
  completionLabel?: string
  value: string
  disabled: boolean
  onChange: (status: ObjectiveStatus) => void
}) {
  const current = statuses.find(status => status.value === value)
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger disabled={disabled} className="gap-2">
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center"><span className="size-2 rounded-full" style={{ backgroundColor: current?.tone ?? "var(--muted-foreground)" }} /></span>
      Status
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal><DropdownMenuSubContent className="canvas-glass min-w-44">
      <DropdownMenuRadioGroup value={value} onValueChange={next => {
        const status = statuses.find(item => item.value === next)
        if (status && !disabled && status.value !== value) onChange(status.value)
      }}>
        {statuses.map(status => <DropdownMenuRadioItem key={status.value} value={status.value} disabled={disabled} className="pl-2 [&>span:first-child]:hidden">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.tone }} />
          {status.value === "done" ? completionLabel : status.label}
          {status.value === value && <Check aria-hidden className="ml-auto" />}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent></DropdownMenuPortal>
  </DropdownMenuSub>
}
