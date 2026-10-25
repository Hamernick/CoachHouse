"use client"
import { useRef, useState } from "react"
import { ChevronDown, Ellipsis } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { OpportunityReportFact } from "../lib/opportunity-report"
import { formatOpportunityCost, opportunityCostTotal } from "../lib/opportunity-costs"
import { OpportunityCostTable } from "./opportunity-cost-table"

function costLabel(item: OpportunityReportFact) {
  const total = item.costs ? opportunityCostTotal(item.costs) : null
  return total === null ? item.value || "Add costs" : `${formatOpportunityCost(total, item.costs?.currency)}${item.costs?.items.some(row => row.amountCents === null) ? " subtotal" : ""}`
}
export function OpportunityFactRow({ item, row, disabled, onChange, onRemove }: { item: OpportunityReportFact; row: number; disabled: boolean; onChange: (item: OpportunityReportFact) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  return <Collapsible ref={root} open={open} onOpenChange={next => {
    const invalid = !next && root.current?.querySelector<HTMLInputElement>("input:invalid")
    if (invalid) { invalid.reportValidity(); return }
    setOpen(next)
  }} className="space-y-1">
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_28px] items-start gap-2 [@media(pointer:coarse)]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_44px]">
      <Textarea rows={1} aria-label={`Fact ${row + 1} label`} placeholder="Label" maxLength={80} value={item.label} disabled={disabled} className="min-h-9 min-w-0 resize-none border-0 bg-transparent px-1 py-2 text-muted-foreground shadow-none dark:bg-transparent" onChange={event => onChange({ ...item, label: event.target.value })} />
      {item.costs ? <CollapsibleTrigger asChild><Button type="button" variant="ghost" aria-label={`${item.label || `Fact ${row + 1}`} cost breakdown`} className="h-auto min-h-9 min-w-0 justify-between gap-1 rounded-md px-1 py-2 text-left font-normal tabular-nums"><span className="min-w-0 break-words whitespace-normal">{costLabel(item)}</span><ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 ${open ? "rotate-180" : ""}`} /></Button></CollapsibleTrigger> : <Textarea rows={1} aria-label={`Fact ${row + 1} value`} placeholder="Value" maxLength={500} value={item.value} disabled={disabled} className="min-h-9 min-w-0 resize-none border-0 bg-transparent px-1 py-2 shadow-none dark:bg-transparent" onChange={event => onChange({ ...item, value: event.target.value })} />}
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" disabled={disabled} className="h-9 w-7 shrink-0 rounded-lg [@media(pointer:coarse)]:size-11" aria-label={`Options for fact ${row + 1}`}><Ellipsis className="size-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        {!item.costs ? <DropdownMenuItem onSelect={() => { onChange({ ...item, costs: { currency: "USD", items: [] } }); setOpen(true) }}>Add cost breakdown</DropdownMenuItem> : <DropdownMenuItem onSelect={() => { const next = { ...item }; delete next.costs; onChange(next); setOpen(false) }}>Remove cost breakdown</DropdownMenuItem>}
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>Remove fact</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
    {item.costs && <CollapsibleContent><OpportunityCostTable value={item.costs} disabled={disabled} onChange={costs => onChange({ ...item, costs })} /></CollapsibleContent>}
  </Collapsible>
}
export function OpportunityFactContent({ item }: { item: OpportunityReportFact }) {
  return <Collapsible asChild><div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2 text-sm">
    <dt className="break-words text-muted-foreground">{item.label}</dt><dd className="min-w-0 break-words">{item.costs ? <CollapsibleTrigger asChild><Button type="button" variant="ghost" aria-label={`${item.label || "Fact"} cost breakdown`} className="h-auto min-h-7 w-full justify-between gap-1 rounded-md px-0 py-0 text-left font-normal tabular-nums"><span>{costLabel(item)}</span><ChevronDown aria-hidden="true" className="size-3.5 shrink-0" /></Button></CollapsibleTrigger> : item.value}</dd>
    {item.costs && <CollapsibleContent asChild><dd className="col-span-2"><OpportunityCostTable value={item.costs} /></dd></CollapsibleContent>}
  </div></Collapsible>
}
