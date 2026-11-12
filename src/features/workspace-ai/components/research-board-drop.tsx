"use client"

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type DragEvent } from "react"
import { ParticleButton } from "@/components/ui/particle-ui"
import { useReactFlow } from "@xyflow/react"
import type { ResearchPlacement } from "../lib/research-placement"

const MIME = "application/x-coach-house-research"
type Drag = { id: string; place: (position: ResearchPlacement) => Promise<void> }
const DropContext = createContext<{ begin: (drag: Drag) => void; cancel: () => void } | null>(null)

/** Drag carries only an ephemeral identity; the live review owns the authorized save. */
export function ResearchBoardDropProvider({ children, canvas, enabled }: {
  children: ReactNode; canvas: HTMLElement | null; enabled: boolean
}) {
  const flow = useReactFlow()
  const active = useRef<Drag | null>(null)
  useEffect(() => {
    if (!canvas || !enabled) { active.current = null; return }
    const accepts = (event: globalThis.DragEvent) => active.current && event.dataTransfer?.types.includes(MIME) &&
      event.target instanceof Element && Boolean(event.target.closest(".react-flow__pane, .react-flow__node, .react-flow__edge"))
    const over = (event: globalThis.DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = "copy"
    }
    const drop = (event: globalThis.DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault(); event.stopPropagation()
      const drag = active.current; active.current = null
      if (drag && event.dataTransfer!.getData(MIME) === drag.id)
        void drag.place(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }
    canvas.addEventListener("dragover", over, true)
    canvas.addEventListener("drop", drop, true)
    return () => {
      active.current = null
      canvas.removeEventListener("dragover", over, true)
      canvas.removeEventListener("drop", drop, true)
    }
  }, [canvas, enabled, flow])
  const value = useMemo(() => ({ begin: (drag: Drag) => { active.current = drag }, cancel: () => { active.current = null } }), [])
  return <DropContext.Provider value={value}>{children}</DropContext.Provider>
}

export function useResearchBoardDrag(place: (position: ResearchPlacement) => Promise<void>, disabled: boolean) {
  const context = useContext(DropContext)
  const latest = useRef({ place, disabled }); latest.current = { place, disabled }
  useEffect(() => () => context?.cancel(), [context])
  return {
    draggable: Boolean(context && !disabled),
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      if (!context || latest.current.disabled) { event.preventDefault(); return }
      const id = crypto.randomUUID()
      event.dataTransfer.effectAllowed = "copy"
      event.dataTransfer.setData(MIME, id)
      context.begin({ id, place: async position => { if (!latest.current.disabled) await latest.current.place(position) } })
    },
    onDragEnd: () => context?.cancel(),
  }
}


export function ResearchBoardAddButton({ disabled, newObjective, onAdd }: {
  disabled: boolean; newObjective: boolean; onAdd: (position?: ResearchPlacement) => Promise<void>
}) {
  const drag = useResearchBoardDrag(onAdd, disabled || !newObjective)
  return <ParticleButton color="primary" type="button" size="md" disabled={disabled} {...drag}
    title={drag.draggable ? "Add to board, or drag onto the canvas" : undefined} onClick={() => void onAdd()}>
    {newObjective ? "Add to board" : "Add proposal"}
  </ParticleButton>
}
