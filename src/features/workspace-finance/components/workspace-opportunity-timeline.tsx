"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { OpportunityTimelineRange } from "../lib/opportunity-report"

export function WorkspaceOpportunityTimeline({ value, onChange, disabled, label = "Timeline", range, onRangeChange }: {
  value: string; onChange: (value: string) => void; disabled: boolean; label?: string
  range?: OpportunityTimelineRange; onRangeChange?: (range: OpportunityTimelineRange | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"single" | "range">(range ? "range" : "single")
  const [draft, setDraft] = useState<DateRange | undefined>()
  const selected = value ? parseISO(value) : undefined
  const displayDate = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  const labelValue = range ? `${displayDate(parseISO(range.from))} – ${displayDate(parseISO(range.to))}` : selected ? displayDate(selected) : "Optional"
  function choose(date: Date | undefined) {
    onRangeChange?.(undefined)
    onChange(date ? format(date, "yyyy-MM-dd") : "")
    setOpen(false)
  }
  return <Popover open={open} onOpenChange={next => {
    setOpen(next)
    if (next) { setMode(range ? "range" : "single"); setDraft(range ? { from: parseISO(range.from), to: parseISO(range.to) } : undefined) }
  }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" disabled={disabled} className="h-auto min-h-9 w-full justify-between gap-3 rounded-lg px-1 text-sm font-normal [@media(pointer:coarse)]:min-h-11" aria-label={`${label}${range ? `, ${range.from} to ${range.to}` : value ? `, ${value}` : ", optional"}`}>
        <span className="flex items-center gap-2"><CalendarDays aria-hidden="true" />{label}</span>
        <span className="min-w-0 text-right text-muted-foreground">{labelValue}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" collisionPadding={12} className="flex w-80 max-w-[calc(100vw-24px)] flex-col gap-2 p-3" aria-label={`${label} picker`}>
      {onRangeChange && <ToggleGroup type="single" value={mode} onValueChange={next => {
        if (next !== "single" && next !== "range") return
        setMode(next)
        if (next === "single") onRangeChange(undefined)
        else setDraft(range ? { from: parseISO(range.from), to: parseISO(range.to) } : undefined)
      }} disabled={disabled} variant="outline" size="sm" className="w-full" aria-label="Date selection">
        <ToggleGroupItem value="single" className="flex-1">Date</ToggleGroupItem>
        <ToggleGroupItem value="range" className="flex-1">Range</ToggleGroupItem>
      </ToggleGroup>}
      {mode === "range" && onRangeChange ? <>
        <Calendar mode="range" min={1} selected={draft} defaultMonth={draft?.from ?? selected} onSelect={next => {
          setDraft(next)
          if (next?.from && next.to) { onRangeChange({ from: format(next.from, "yyyy-MM-dd"), to: format(next.to, "yyyy-MM-dd") }); setOpen(false) }
        }} disabled={disabled} className="p-0" />
        <p role="status" className="text-center text-xs text-muted-foreground">{draft?.from && !draft.to ? "Choose an end date" : "Choose a start and end date"}</p>
      </> : <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={choose} disabled={disabled} className="p-0" />}
      {value && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => choose(undefined)}>Clear dates</Button>}
    </PopoverContent>
  </Popover>
}
