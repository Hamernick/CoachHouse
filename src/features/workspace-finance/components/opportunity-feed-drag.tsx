"use client"
import { createPortal } from "react-dom"
import { useId, useState, type ReactNode } from "react"
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, closestCenter, useDndContext, useDroppable, useSensor, useSensors, type DragEndEvent, type CollisionDetection } from "@dnd-kit/core"
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useReducedMotion } from "motion/react"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import type { WorkspaceFinanceOpportunityInput } from "../types"
import type { OpportunityFeedFilter } from "../lib/opportunity-feed-filters"

const collisionDetection: CollisionDetection = args => {
  const point = args.pointerCoordinates
  if (!point) return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(container => container.data.current?.sortable) })
  return pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter(container => {
    const node = container.node.current
    const viewport = node?.closest('[role="tablist"]')?.parentElement ?? node?.closest('[data-scroll-fade-managed="true"]')
    if (!viewport) return true
    const rect = viewport.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  }) })
}

export type OpportunityCanvasDrop = { x: number; y: number }
export function OpportunityFeedDrag({ items, disabled, children, onReorder, onStage, onCanvas }: {
  items: WorkspaceFinanceOpportunityInput[]; disabled: boolean; children: ReactNode
  onReorder: (id: string, target: string) => void
  onStage: (item: WorkspaceFinanceOpportunityInput, filter: OpportunityFeedFilter) => void
  onCanvas?: (item: WorkspaceFinanceOpportunityInput, position: OpportunityCanvasDrop) => void
}) {
  const id = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const active = items.find(item => item.id === activeId)
  const finish = ({ active, over, activatorEvent, delta }: DragEndEvent) => {
    setActiveId(null)
    if (disabled) return
    const item = items.find(item => item.id === active.id)
    if (!item) return
    if (over?.data.current?.filter) { onStage(item, over.data.current.filter as OpportunityFeedFilter); return }
    if (over && active.id !== over.id && items.some(item => item.id === over.id)) { onReorder(item.id, String(over.id)); return }
    if (over || !onCanvas) return
    const start = "touches" in activatorEvent ? (activatorEvent as TouchEvent).touches[0] : activatorEvent as MouseEvent
    if (!start || !Number.isFinite(start.clientX)) return
    const hit = document.elementFromPoint(start.clientX + delta.x, start.clientY + delta.y)
    if (!hit?.closest("[data-workspace-canvas-flow-frame] .react-flow") || hit.closest("[data-workspace-content-window], [data-planning-sidebar], [data-opportunity-view]")) return
    const rect = active.rect.current.translated
    if (rect) onCanvas(item, { x: rect.left, y: rect.top })
  }
  return <DndContext id={id} sensors={sensors} collisionDetection={collisionDetection} onDragStart={({ active }) => setActiveId(String(active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={finish}
    accessibility={{ screenReaderInstructions: { draggable: "Press Space to pick up. Use arrow keys to reorder, Space to drop, or Escape to cancel." }, announcements: {
      onDragStart: ({ active }) => `Picked up ${items.find(item => item.id === active.id)?.title ?? "opportunity"}.`,
      onDragOver: ({ over }) => over?.data.current?.filter ? `Move to ${over.data.current.filter}.` : over ? `Position ${items.findIndex(item => item.id === over.id) + 1}.` : "Outside the list. Drop on the canvas to add, or Escape to cancel.",
      onDragEnd: () => "Drag finished.", onDragCancel: () => "Drag canceled.",
    } }}>
    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy} disabled={disabled}>{children}</SortableContext>
    {typeof document !== "undefined" && createPortal(<DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>{active && <div inert className="pointer-events-none rounded-lg border border-border/60 bg-card p-3 text-sm"><p className="font-semibold">{active.title}</p>{active.source && <p className="mt-1 text-muted-foreground">{active.source}</p>}</div>}</DragOverlay>, document.body)}
  </DndContext>
}

export function SortableOpportunity({ item, disabled, children }: { item: WorkspaceFinanceOpportunityInput; disabled: boolean; children: (renderTitle: (content: ReactNode, disclosure?: { onClick: () => void; expanded: boolean }) => ReactNode) => ReactNode }) {
  const reduced = useReducedMotion()
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled, transition: reduced ? null : { duration: 180, easing: "ease-in-out" }, data: { opportunity: item } })
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} className="min-w-0" onMouseDown={event => {
    if (disabled || (event.target instanceof Element && event.target.closest("button,a,input,textarea,select,[contenteditable=true]"))) return
    listeners?.onMouseDown?.(event)
  }}>
    {children((content, disclosure) => disabled && !disclosure ? <span className="flex min-h-8 items-center gap-2">{content}</span> : <Button ref={setActivatorNodeRef} type="button" variant="ghost" {...(!disabled ? attributes : {})} {...(!disabled ? listeners : {})} aria-label={disclosure ? item.title : `Move ${item.title}`} aria-expanded={disclosure?.expanded} onClick={() => { if (!isDragging) disclosure?.onClick() }} className={`h-auto min-h-8 w-full touch-pan-y justify-start gap-2 whitespace-normal rounded-md p-0 text-left hover:bg-transparent active:cursor-grabbing [@media(pointer:coarse)]:min-h-11 ${disclosure ? "text-[13px] font-normal leading-5 text-[color:var(--planning-panel-text,var(--foreground))]" : "text-sm font-semibold leading-snug"}`}>{content}</Button>)}
  </li>
}

export function OpportunityTabTarget({ filter, disabled, children }: { filter: OpportunityFeedFilter; disabled: boolean; children: ReactNode }) {
  const { active } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({ id: `opportunity-tab:${filter}`, data: { filter }, disabled: disabled || filter === "all" })
  return <div ref={setNodeRef} data-opportunity-drop-tab={filter} data-drop-active={Boolean(active && isOver)} className={`shrink-0 rounded-lg transition-colors ${active && isOver ? "bg-foreground/10 ring-1 ring-inset ring-foreground/30" : ""}`}>{children}</div>
}
