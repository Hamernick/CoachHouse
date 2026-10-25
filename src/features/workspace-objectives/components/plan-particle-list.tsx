"use client"

import { createPortal } from "react-dom"
import { useId, useRef, useState, type ReactNode } from "react"
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type KeyboardCoordinateGetter, type CollisionDetection } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Particle } from "@/features/workspace-particles/client"
import { ParticleStatusMark, ParticleStatusLabel } from "./particle-status"
import styles from "./particle-objectives.module.css"

export function PlanParticleList({ label, particles, disabled, onMove, children, onDragOver, onDrop, className = styles.branch }: {
  label: string; particles: Particle[]; disabled: boolean; children: ReactNode; className?: string
  onMove: (id: string, index: number) => void
  onDragOver?: React.DragEventHandler<HTMLUListElement>
  onDrop?: React.DragEventHandler<HTMLUListElement>
}) {
  const id = useId()
  const list = useRef<HTMLUListElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragHeight, setDragHeight] = useState<number | undefined>(undefined)
  const active = particles.find(particle => particle.id === activeId)
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return
    event.preventDefault()
    const index = particles.findIndex(particle => particle.id === (context.over?.id ?? context.active?.id))
    const next = particles[index + (event.code === "ArrowDown" ? 1 : -1)]
    const target = next && context.droppableRects.get(next.id)
    const current = context.collisionRect
    if (!target || !current) return
    return { x: currentCoordinates.x, y: currentCoordinates.y + target.top + target.height / 2 - current.top - current.height / 2 }
  }
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  )
  const collision: CollisionDetection = args => {
    const point = args.pointerCoordinates
    const bounds = list.current?.getBoundingClientRect()
    if (point && bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom)) return []
    return closestCenter(point ? { ...args, collisionRect: { ...args.collisionRect, top: point.y, bottom: point.y, left: point.x, right: point.x, height: 0, width: 0 } } : args)
  }
  const title = (value: string | number) => particles.find(particle => particle.id === value)?.title ?? "Item"
  return <DndContext id={id} sensors={sensors} collisionDetection={collision}
    accessibility={{
      screenReaderInstructions: { draggable: "Press Space to reorder. Use the arrow keys to move, Space to drop, or Escape to cancel. Press Enter to open." },
      announcements: {
        onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
        onDragOver: ({ active, over }) => over ? `${title(active.id)}, position ${particles.findIndex(particle => particle.id === over.id) + 1} of ${particles.length}.` : "Outside this plan. Release to cancel.",
        onDragEnd: ({ active, over }) => over && !disabled ? `${title(active.id)} dropped at position ${particles.findIndex(particle => particle.id === over.id) + 1}.` : "Reordering canceled.",
        onDragCancel: () => "Reordering canceled.",
      },
    }}
    onDragStart={({ active }) => {
      if (disabled) return
      setDragHeight(list.current?.children[particles.findIndex(particle => particle.id === active.id)]?.getBoundingClientRect().height)
      setActiveId(String(active.id))
    }}
    onDragCancel={() => setActiveId(null)}
    onDragEnd={({ active, over }) => {
      setActiveId(null)
      if (disabled || !over || active.id === over.id) return
      const target = particles.findIndex(particle => particle.id === over.id)
      if (target < 0 || !particles.some(particle => particle.id === active.id)) return
      onMove(String(active.id), target)
    }}>
    <SortableContext items={particles.map(particle => particle.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
      <ul ref={list} className={className} aria-label={label} onDragOver={onDragOver} onDrop={onDrop}>{children}</ul>
    </SortableContext>
    {active ? createPortal(<DragOverlay dropAnimation={null}>
      <div style={{ height: dragHeight }}>
      <div inert className="pointer-events-none flex min-h-11 items-center gap-2 rounded-xl bg-muted px-2 text-sm font-medium select-none"><ParticleStatusMark particle={active} /><span className="min-w-0 flex-1 break-words">{active.title}</span><ParticleStatusLabel particle={active} /></div>
      </div>
    </DragOverlay>, document.body) : null}
  </DndContext>
}
