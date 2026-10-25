"use client"

import type { ReactNode, KeyboardEvent } from "react"
import CalendarIcon from "lucide-react/dist/esm/icons/calendar-days"
import ClockIcon from "lucide-react/dist/esm/icons/clock-3"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import CornerDownLeftIcon from "lucide-react/dist/esm/icons/corner-down-left"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { WorkspaceNodeFrameHeader, WorkspaceNodeFrameBody, WorkspaceNodeFrameFooter } from "@/components/workspace/workspace-node-frame"
import { ParticleFrame } from "./particle-frame"
import { ParticleEventDateControl } from "./particle-event-date-control"
import { eventDraftError, type EventDraft, type EventWidget } from "../lib/particle-event"
import styles from "./particle-sizing.module.css"

/** Same surface in the library, drag overlay and canvas. Draft controls are
 * local-only; the existing placement owner performs the sole Add operation. */
export function ParticleEventCard({ title, event, draft, onChange, onAdd, onClear, disabled = false, pending = false, selected = false, children, editorFields }: {
  title: string; event: EventWidget; draft?: EventDraft
  onChange?: (draft: EventDraft) => void; onAdd?: () => void; onClear?: () => void
  disabled?: boolean; pending?: boolean; selected?: boolean; children?: ReactNode; editorFields?: ReactNode
}) {
  const change = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => { if (draft && !disabled && !pending) onChange?.({ ...draft, [key]: value }) }
  const problem = draft ? eventDraftError(draft) : null
  const instant = event.startsAt ? new Date(event.startsAt) : null
  const names = draft?.guests.split(",").map(name => name.trim()).filter(Boolean) ?? event.attendees ?? []
  function keyDown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.nativeEvent.isComposing || !(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return
    if (e.key === "Escape" && onClear && !disabled && !pending) { e.preventDefault(); e.stopPropagation(); onClear() }
    if (e.key === "Enter" && e.target instanceof HTMLInputElement && onAdd && !disabled && !pending && !problem) { e.preventDefault(); e.stopPropagation(); onAdd() }
  }
  return (
      <ParticleFrame selected={selected} className="bg-card p-0" onKeyDown={keyDown}>
        {children}
        <WorkspaceNodeFrameHeader className="workspace-card-drag-handle cursor-grab items-center px-4 pt-4 pb-2 active:cursor-grabbing">
          {draft ? <Input aria-label="Event title" name="event-title" placeholder="What’s the event?" value={draft.title} maxLength={240}
            disabled={disabled || pending} onChange={e => change("title", e.currentTarget.value)}
            className="nodrag nopan h-8 min-w-0 rounded-xl border-0 bg-transparent px-1 shadow-none dark:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:pr-10"/>
            : <h3 className="min-w-0 px-1 text-sm font-medium break-words">{title}</h3>}
        </WorkspaceNodeFrameHeader>
        <WorkspaceNodeFrameBody className={`${styles.body} flex flex-col gap-3 px-5 pt-1 pb-5`}>
          {editorFields}
          <div className="flex items-center gap-2.5">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl"><CalendarIcon className="size-4" aria-hidden/></span>
            <span className="text-muted-foreground text-xs">Event</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft ? <><ParticleEventDateControl type="date" value={draft.date} onChange={value => change("date", value)} disabled={disabled || pending}/><ParticleEventDateControl type="time" value={draft.time} onChange={value => change("time", value)} disabled={disabled || pending}/></>
              : instant ? <><span className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"><CalendarIcon className="size-3" aria-hidden/><span suppressHydrationWarning>{instant.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span><span className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"><ClockIcon className="size-3" aria-hidden/><span suppressHydrationWarning>{instant.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></span></>
                : <span className="text-muted-foreground text-xs">Date to be confirmed</span>}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <MapPinIcon className="text-muted-foreground size-4 shrink-0" aria-hidden/>
            {draft ? <Input aria-label="Event place" name="event-place" placeholder="+ Add place" value={draft.location} maxLength={500} disabled={disabled || pending} onChange={e => change("location", e.currentTarget.value)} className="nodrag nopan h-7 min-w-0 max-w-56 rounded-full border-dashed px-3 shadow-none [@media(pointer:coarse)]:min-h-11"/>
              : <span className="text-muted-foreground text-xs break-words">{event.location || "Place to be confirmed"}</span>}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-7 shrink-0"><AvatarFallback className="text-[10px]">{names[0]?.slice(0, 1).toUpperCase() || "+"}</AvatarFallback></Avatar>
            {draft ? <Input aria-label="Event attendees" name="event-attendees" placeholder="Add people…" title="Separate names with commas" value={draft.guests} maxLength={6000} disabled={disabled || pending} onChange={e => change("guests", e.currentTarget.value)} className="nodrag nopan h-7 min-w-0 rounded-xl border-0 bg-transparent px-1 shadow-none dark:bg-transparent [@media(pointer:coarse)]:min-h-11"/>
              : <span className="text-muted-foreground text-xs break-words">{names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "") : "No attendees added"}</span>}
          </div>
          {draft && draft.title.trim() && problem ? <p role="status" className="text-muted-foreground text-xs">{problem}</p> : null}
        </WorkspaceNodeFrameBody>
        {onAdd ? <WorkspaceNodeFrameFooter className="justify-between gap-3 px-5 pt-2 pb-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled || pending} className="nodrag nopan text-muted-foreground h-7 rounded-full px-0 text-xs [@media(pointer:coarse)]:min-h-11"><kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">Esc</kbd> to clear</Button>
          <Button type="button" size="sm" aria-label="Add event to canvas and calendar" disabled={disabled || pending || Boolean(problem)} onClick={onAdd} className="nodrag nopan h-8 rounded-full px-3 text-xs [@media(pointer:coarse)]:min-h-11">
            {pending ? <LoaderIcon className="animate-spin motion-reduce:animate-none" aria-hidden/> : null}Add event<CornerDownLeftIcon data-icon="inline-end" aria-hidden/>
          </Button>
        </WorkspaceNodeFrameFooter> : null}
      </ParticleFrame>
  )
}
