"use client"

import { useId, useState } from "react"
import { Reorder, useDragControls, useReducedMotion } from "motion/react"
import GripIcon from "lucide-react/dist/esm/icons/grip-vertical"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import ArrowDownIcon from "lucide-react/dist/esm/icons/arrow-down"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldSet, FieldLegend } from "@/components/ui/field"
import type { PageChoice } from "../lib/page-editor"

const CONTROL = "size-7 rounded-full shadow-none transition-none [@media(pointer:coarse)]:size-11"
export function SharePageMembers({ choices, selected, disabled, errorId, invalid, onToggle, onMove, onReorder }: {
  choices: PageChoice[]; selected: string[]; disabled: boolean; errorId?: string; invalid: boolean
  onToggle: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void
  onReorder: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(20)
  const id = useId()
  const byId = new Map(choices.map((item) => [item.id, item]))
  const available = choices.filter((item) => !selected.includes(item.id) && item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <FieldSet id={`${id}-selection`} tabIndex={-1} className="min-w-0 gap-2" aria-invalid={invalid} aria-describedby={errorId} aria-disabled={disabled}>
    <FieldLegend className="text-sm font-medium">Particles <span className="text-muted-foreground font-normal">{selected.length}/50</span></FieldLegend>
    <Reorder.Group as="ol" axis="y" values={selected} onReorder={(ids) => { if (!disabled) onReorder(ids) }} layoutScroll
      className="divide-border/60 max-h-[min(28rem,50vh)] min-w-0 divide-y divide-dashed overflow-y-auto overscroll-contain">
      {selected.map((key, index) => <ShareMemberRow key={key} id={key} item={byId.get(key)} index={index} count={selected.length} disabled={disabled} onToggle={onToggle} onMove={onMove} />)}
    </Reorder.Group>
    {choices.length > 12 && <Input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(20) }} aria-label="Filter Particles for this page" placeholder="Filter Particles…" disabled={disabled} />}
    <div className="divide-border/60 divide-y divide-dashed">
      {available.slice(0, limit).map((item) => <label key={item.id} htmlFor={`${id}-${item.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
        <Checkbox id={`${id}-${item.id}`} checked={false} disabled={disabled || Boolean(item.reason) || selected.length >= 50} onCheckedChange={() => onToggle(item.id)} />
        <span className="min-w-0"><span className="block break-words text-sm">{item.title}</span>{item.reason && <span className="text-muted-foreground block text-xs">{item.reason}</span>}</span>
      </label>)}
    </div>
    {available.length > limit && <Button type="button" variant="ghost" size="sm" className="self-start rounded-full [@media(pointer:coarse)]:min-h-11" onClick={() => setLimit((value) => value + 20)} disabled={disabled}>Show more</Button>}
  </FieldSet>
}

function ShareMemberRow({ id, item, index, count, disabled, onToggle, onMove }: {
  id: string; item?: PageChoice; index: number; count: number; disabled: boolean
  onToggle: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void
}) {
  const controls = useDragControls()
  const reduce = useReducedMotion()
  const title = item?.title ?? "Unavailable Particle"
  return <Reorder.Item value={id} dragListener={false} dragControls={controls} drag={disabled ? false : "y"}
    transition={{ duration: reduce ? 0 : 0.15, ease: "easeOut" }}
    className="bg-background relative flex min-w-0 items-center gap-1 py-2">
    <Button type="button" variant="ghost" size="icon" className={`${CONTROL} touch-none cursor-grab active:cursor-grabbing`} aria-label={`Reorder ${title}`} disabled={disabled || count < 2}
      onPointerDown={(event) => { if (!disabled) controls.start(event) }} onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault(); onMove(id, event.key === "ArrowUp" ? -1 : 1)
      }}><GripIcon aria-hidden className="text-muted-foreground" /></Button>
    <span className="text-muted-foreground w-4 shrink-0 text-xs">{index + 1}</span>
    <div className="min-w-0 flex-1"><p className="break-words text-sm">{title}</p>{(!item || item.reason) && <p className="text-destructive text-xs">{item?.reason ?? "Remove this unavailable item before publishing."}</p>}</div>
    <div className="flex shrink-0 items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon" className={CONTROL} aria-label={`Move ${title} up`} disabled={disabled || index === 0} onClick={() => onMove(id, -1)}><ArrowUpIcon aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" className={CONTROL} aria-label={`Move ${title} down`} disabled={disabled || index === count - 1} onClick={() => onMove(id, 1)}><ArrowDownIcon aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" className={CONTROL} aria-label={`Remove ${title} from page`} disabled={disabled} onClick={() => onToggle(id)}><XIcon aria-hidden /></Button>
    </div>
  </Reorder.Item>
}
