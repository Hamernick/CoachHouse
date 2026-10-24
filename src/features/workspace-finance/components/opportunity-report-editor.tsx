"use client"
import { useRef, useState } from "react"
import { MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { createOpportunityReportBlock, opportunityReportComponents, type OpportunityReport, type OpportunityReportBlock } from "../lib/opportunity-report"
import { OpportunityFactRow } from "./opportunity-fact-row"
import { OpportunityReportImageEditor } from "./opportunity-report-image-editor"
import { OpportunityReportSourceEditor, type ReportSourceEditorProps } from "./opportunity-report-source-editor"

export function OpportunityReportEditor({ value, onChange, addControlId, ...sources }: ReportSourceEditorProps & { addControlId: string; value: OpportunityReport; onChange: (value: OpportunityReport) => void }) {
  const [imageEditing, setImageEditing] = useState<{ id: string; field: "source" | "description" } | null>(null)
  const focusAfterMenu = useRef<string | null>(null)
  const restoreFocus = (event: Event) => {
    if (!focusAfterMenu.current) return
    event.preventDefault()
    const target = document.getElementById(focusAfterMenu.current)
    ;(target?.querySelector<HTMLElement>("input, textarea") ?? target)?.focus(); focusAfterMenu.current = null
  }
  const update = (block: OpportunityReportBlock) => onChange({ ...value, blocks: value.blocks.map(item => item.id === block.id ? block : item) })
  function move(index: number, delta: number) {
    const blocks = [...value.blocks]
    ;[blocks[index], blocks[index + delta]] = [blocks[index + delta], blocks[index]]
    focusAfterMenu.current = `report-heading-${value.blocks[index].id}`
    onChange({ ...value, blocks })
  }
  return <div className="divide-y divide-border/50">{value.blocks.map((block, index) => {
    const menu = <DropdownMenu><DropdownMenuTrigger asChild><Button id={block.kind === "image" ? `report-heading-${block.id}` : undefined} type="button" variant={block.kind === "image" ? "secondary" : "ghost"} size="icon" className="size-9 shrink-0 rounded-lg shadow-none [@media(pointer:coarse)]:size-11" disabled={sources.disabled} aria-label={`Options for ${block.title || opportunityReportComponents[block.kind]}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={restoreFocus}>
        {block.kind === "image" && <>
          <DropdownMenuItem onSelect={() => { setImageEditing({ id: block.id, field: "source" }); focusAfterMenu.current = `report-source-${block.id}` }}>Replace image</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setImageEditing({ id: block.id, field: "description" }); focusAfterMenu.current = `report-description-${block.id}` }}>Edit description</DropdownMenuItem>
          <DropdownMenuSeparator />
        </>}<DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>Move up</DropdownMenuItem><DropdownMenuItem disabled={index === value.blocks.length - 1} onSelect={() => move(index, 1)}>Move down</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => {
        const neighbor = value.blocks[index + 1] ?? value.blocks[index - 1]
        focusAfterMenu.current = neighbor ? `report-heading-${neighbor.id}` : addControlId
        onChange({ ...value, blocks: value.blocks.filter(item => item.id !== block.id) })
      }}>Remove component</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    return <section key={block.id} aria-label={`${opportunityReportComponents[block.kind]} component`} className="group/report-section space-y-2 py-4 first:pt-0 last:pb-0">
    {block.kind !== "image" && <div className="flex items-center gap-2"><Textarea id={`report-heading-${block.id}`} rows={1} value={block.title} placeholder={opportunityReportComponents[block.kind]} aria-label={`${opportunityReportComponents[block.kind]} heading`} maxLength={80} className="min-h-9 resize-none border-0 bg-transparent px-1 py-1.5 font-medium shadow-none dark:bg-transparent" onChange={event => update({ ...block, title: event.target.value })} />
      {menu}
    </div>}
    {block.kind === "text" && <Textarea value={block.text} placeholder="Write here…" aria-label="Report text" maxLength={6000} rows={3} className="min-h-20 resize-none border-0 bg-transparent px-1 py-1 leading-relaxed shadow-none dark:bg-transparent" onChange={event => update({ ...block, text: event.target.value })} />}
    {block.kind === "facts" && <div className="space-y-2">{block.items.map((item, row) => <OpportunityFactRow key={item.id} item={item} row={row} disabled={sources.disabled} onChange={next => update({ ...block, items: block.items.map(value => value.id === item.id ? next : value) })} onRemove={() => update({ ...block, items: block.items.filter(value => value.id !== item.id) })} />)}<Button type="button" variant="ghost" size="sm" disabled={block.items.length >= 12} onClick={() => update({ ...block, items: [...block.items, { id: crypto.randomUUID(), label: "", value: "" }] })}><Plus className="size-3.5" />Add fact</Button></div>}
    {block.kind === "sources" && <OpportunityReportSourceEditor {...sources} value={block.sources} onChange={next => update({ ...block, sources: next })} />}
    {block.kind === "image" && <OpportunityReportImageEditor {...sources} block={block} onChange={update} menu={menu} editing={imageEditing?.id === block.id ? imageEditing.field : null} onClose={() => setImageEditing(null)} />}
  </section>})}</div>
}

export function OpportunityReportAddMenu({ id, value, onChange, disabled }: { id: string; value: OpportunityReport; onChange: (value: OpportunityReport) => void; disabled: boolean }) {
  const focusId = useRef<string | null>(null)
  return <DropdownMenu><DropdownMenuTrigger asChild><Button id={id} type="button" variant="ghost" size="sm" className="min-h-9 rounded-lg [@media(pointer:coarse)]:min-h-11" aria-label="Add component" disabled={disabled || value.blocks.length >= 12}><Plus className="size-4" aria-hidden="true" />Add</Button></DropdownMenuTrigger><DropdownMenuContent align="start" side="top" className="rounded-xl" onCloseAutoFocus={event => {
    if (!focusId.current) return
    event.preventDefault()
    const heading = document.getElementById(`report-heading-${focusId.current}`)
    heading?.focus(); heading?.scrollIntoView({ block: "center" }); focusId.current = null
  }}>{(Object.keys(opportunityReportComponents) as OpportunityReportBlock["kind"][]).map(kind => <DropdownMenuItem key={kind} onSelect={() => {
    const block = createOpportunityReportBlock(kind)
    onChange({ ...value, blocks: [...value.blocks, block] })
    focusId.current = block.id
  }}>{opportunityReportComponents[kind]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
}
