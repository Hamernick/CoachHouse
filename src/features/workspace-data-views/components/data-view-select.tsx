"use client"
import type { ReactNode } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DataViewSelect({ value, onChange, children, id, disabled, autoFocus, "aria-label": label }: {
  value: string; onChange: (event: { target: { value: string } }) => void; children: ReactNode; id?: string; disabled?: boolean; autoFocus?: boolean; "aria-label"?: string
}) {
  return <Select value={value || "__empty__"} disabled={disabled} onValueChange={next => onChange({ target: { value: next === "__empty__" ? "" : next } })}>
    <SelectTrigger id={id} aria-label={label} autoFocus={autoFocus}><SelectValue /></SelectTrigger>
    <SelectContent><SelectGroup>{children}</SelectGroup></SelectContent>
  </Select>
}
export function DataViewOption({ value, children }: { value: string; children: ReactNode }) {
  return <SelectItem value={value || "__empty__"}>{children}</SelectItem>
}
