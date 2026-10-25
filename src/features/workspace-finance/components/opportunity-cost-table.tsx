"use client"
import { useState } from "react"
import { Ellipsis, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { formatOpportunityCost, opportunityCostTotal, parseOpportunityCost, type OpportunityCosts } from "../lib/opportunity-costs"

function CostInput({ item, row, onChange, disabled }: { item: OpportunityCosts["items"][number]; row: number; onChange: (cents: number | null) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(item.amountCents === null ? "" : (item.amountCents / 100).toFixed(2))
  return <Input aria-label={`Item ${row + 1} cost`} inputMode="decimal" placeholder="0.00" disabled={disabled} value={draft} maxLength={13}
    className="h-9 min-w-0 rounded-md border-0 bg-transparent px-1 text-right text-clip tabular-nums shadow-none dark:bg-transparent"
    onChange={event => {
      const value = event.target.value
      setDraft(value)
      const cents = parseOpportunityCost(value)
      event.target.setCustomValidity(cents === undefined ? "Enter a positive cost with up to two decimal places." : "")
      if (cents !== undefined) onChange(cents)
    }} onBlur={event => { const cents = parseOpportunityCost(event.target.value); if (cents !== undefined) setDraft(cents === null ? "" : (cents / 100).toFixed(2)) }} />
}
export function OpportunityCostTable({ value, onChange, disabled = false }: { value: OpportunityCosts; onChange?: (value: OpportunityCosts) => void; disabled?: boolean }) {
  const total = opportunityCostTotal(value)
  const update = (item: OpportunityCosts["items"][number]) => onChange?.({ ...value, items: value.items.map(current => current.id === item.id ? item : current) })
  return <div className="min-w-0 space-y-2 rounded-lg bg-muted/25 p-2">
    <Table className="w-full table-fixed text-xs"><caption className="sr-only">Cost breakdown in {value.currency}</caption><TableHeader><TableRow>
      <TableHead className="h-8 p-1 font-normal">Title</TableHead><TableHead className="h-8 w-24 p-1 text-right font-normal">Cost ({value.currency})</TableHead><TableHead className="h-8 w-24 p-1 pl-3 font-normal">Type</TableHead>{onChange && <TableHead className="h-8 w-7 p-0"><span className="sr-only">Actions</span></TableHead>}
    </TableRow></TableHeader><TableBody>{value.items.map((item, row) => <TableRow key={item.id} className="hover:bg-transparent">
      <TableCell className="p-1 align-top whitespace-normal">{onChange ? <Textarea id={`cost-title-${item.id}`} rows={1} aria-label={`Item ${row + 1} title`} placeholder="Item" maxLength={120} value={item.title} disabled={disabled} className="min-h-9 resize-none border-0 bg-transparent px-1 py-2 shadow-none dark:bg-transparent" onChange={event => update({ ...item, title: event.target.value })} /> : <span className="break-words">{item.title || "Untitled item"}</span>}</TableCell>
      <TableCell className="p-1 text-right align-top tabular-nums break-all whitespace-normal">{onChange ? <CostInput item={item} row={row} disabled={disabled} onChange={amountCents => update({ ...item, amountCents })} /> : item.amountCents === null ? "—" : formatOpportunityCost(item.amountCents, value.currency)}</TableCell>
      <TableCell className="p-1 pl-3 align-top">{onChange ? <Select value={item.type} disabled={disabled} onValueChange={type => { if (type === "fixed" || type === "variable") update({ ...item, type }) }}><SelectTrigger aria-label={`Item ${row + 1} cost type`} className="h-9 w-full gap-1 border-0 bg-transparent px-1 text-xs shadow-none dark:bg-transparent"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="variable">Variable</SelectItem></SelectContent></Select> : item.type === "fixed" ? "Fixed" : "Variable"}</TableCell>
      {onChange && <TableCell className="p-0 align-top"><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" disabled={disabled} aria-label={`Options for cost item ${row + 1}`} className="h-9 w-7 rounded-md"><Ellipsis className="size-3.5" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={() => onChange({ ...value, items: value.items.filter(current => current.id !== item.id) })}>Remove item</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>}
    </TableRow>)}</TableBody></Table>
    <div className="flex min-h-9 items-center justify-between gap-2">
      {onChange && <Button type="button" size="sm" variant="ghost" disabled={disabled || value.items.length >= 20} className="rounded-md px-1 text-xs" onClick={() => { const id = crypto.randomUUID(); onChange({ ...value, items: [...value.items, { id, title: "", amountCents: null, type: "fixed" }] }); requestAnimationFrame(() => document.getElementById(`cost-title-${id}`)?.focus()) }}><Plus className="size-3.5" aria-hidden="true" />Add item</Button>}
      <span className="ml-auto text-xs tabular-nums" aria-live="polite">{value.items.some(item => item.amountCents === null) ? "Subtotal" : "Total"} {total === null ? "—" : formatOpportunityCost(total, value.currency)}</span>
    </div>
  </div>
}
