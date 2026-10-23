"use client"

import { useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import styles from "@/components/organization/org-profile-card/profile-edit-fields.module.css"

export function WorkspaceOpportunityTimeline({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = value ? parseISO(value) : undefined
  function choose(date: Date | undefined) {
    onChange(date ? format(date, "yyyy-MM-dd") : "")
    setOpen(false)
    trigger.current?.focus()
  }
  return <Collapsible open={open} onOpenChange={setOpen} disabled={disabled} className={`${styles.row} ${styles.stacked} !py-1`}>
    <CollapsibleTrigger asChild>
      <Button ref={trigger} type="button" variant="ghost" disabled={disabled} className="h-auto min-h-12 w-full justify-between gap-3 rounded-lg px-1 font-normal" aria-label={`Timeline${value ? `, ${value}` : ", optional"}`}>
        <span className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />Timeline</span>
        <span className="text-muted-foreground">{selected ? selected.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Optional"}</span>
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="min-w-0 pb-2">
      <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={choose} disabled={disabled} className="mx-auto w-full max-w-72 p-0 [--cell-size:calc((100%_-_2.25rem)/7)]" />
      {value && <Button type="button" variant="ghost" disabled={disabled} className="mt-2 min-h-11 w-full rounded-full text-muted-foreground" onClick={() => choose(undefined)}>Clear date</Button>}
    </CollapsibleContent>
  </Collapsible>
}
