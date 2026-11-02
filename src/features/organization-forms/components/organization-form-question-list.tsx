"use client"

import { useId, useRef, type ReactNode } from "react"
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type CollisionDetection, type KeyboardCoordinateGetter } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import GripVerticalIcon from "lucide-react/dist/esm/icons/grip-vertical"
import { Button } from "@/components/ui/button"
import { Collapsible } from "@/components/ui/collapsible"
import { reorderFormQuestion } from "../lib/form-editing"
import type { FormDefinition, FormQuestion } from "../types"
import styles from "./organization-form-builder.module.css"

export function FormQuestionList({ definition, disabled, onChange, children }: {
  definition: FormDefinition; disabled: boolean; onChange: (value: FormDefinition) => void; children: ReactNode
}) {
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  const started = useRef<FormDefinition | null>(null)
  // Center targets: expanded editors have different heights from collapsed rows.
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return
    event.preventDefault()
    const index = definition.questions.findIndex(question => question.id === (context.over?.id ?? context.active?.id))
    const next = definition.questions[index + (event.code === "ArrowDown" ? 1 : -1)]
    const target = next && context.droppableRects.get(next.id)
    const current = context.collisionRect
    if (!target || !current) return
    return { x: currentCoordinates.x, y: currentCoordinates.y + target.top + target.height / 2 - current.top - current.height / 2 }
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  )
  const collision: CollisionDetection = args => {
    const point = args.pointerCoordinates
    const bounds = list.current?.getBoundingClientRect()
    if (point && bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom)) return []
    return closestCenter(point ? { ...args, collisionRect: { ...args.collisionRect, top: point.y, bottom: point.y, left: point.x, right: point.x, height: 0, width: 0 } } : args)
  }
  const title = (key: string | number) => definition.questions.find(question => question.id === key)?.label.trim() || "Question"
  return <DndContext id={id} sensors={sensors} collisionDetection={collision}
    accessibility={{
      screenReaderInstructions: { draggable: "Press Space to reorder. Use arrow keys to move, Space to drop, or Escape to cancel." },
      announcements: {
        onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
        onDragOver: ({ over }) => over ? `Position ${definition.questions.findIndex(question => question.id === over.id) + 1} of ${definition.questions.length}.` : "Outside the form. Release to cancel.",
        onDragCancel: () => "Reordering canceled.",
        onDragEnd: ({ active, over }) => over && !disabled && started.current === definition ? `${title(active.id)} moved to position ${definition.questions.findIndex(question => question.id === over.id) + 1}.` : "Reordering canceled.",
      },
    }}
    onDragStart={() => { started.current = disabled ? null : definition }}
    onDragEnd={({ active, over }) => {
      if (disabled || started.current !== definition || !over) return
      const next = reorderFormQuestion(definition, String(active.id), String(over.id))
      if (next !== definition) onChange(next)
    }}>
    <SortableContext items={definition.questions.map(question => question.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
      <div ref={list} className={styles.rows} aria-label="Question order">{children}</div>
    </SortableContext>
  </DndContext>
}

export function SortableFormQuestion({ question, index, disabled, open, onOpenChange, children }: {
  question: FormQuestion; index: number; disabled: boolean; open: boolean; onOpenChange: (open: boolean) => void
  children: (handle: ReactNode) => ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const sortable = useSortable({ id: question.id, disabled, transition: reducedMotion ? null : { duration: 150, easing: "ease" } })
  return <Collapsible ref={sortable.setNodeRef} open={open} onOpenChange={onOpenChange} className={styles.row}
    style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, position: "relative", zIndex: sortable.isDragging ? 1 : undefined }}>
    {children(<Button type="button" variant="ghost" size="icon" className={styles.dragHandle}
      ref={sortable.setActivatorNodeRef} disabled={disabled} {...sortable.attributes} {...sortable.listeners}
      aria-label={`Reorder question ${index + 1}: ${question.label.trim() || "Untitled"}`}><GripVerticalIcon aria-hidden /></Button>)}
  </Collapsible>
}
