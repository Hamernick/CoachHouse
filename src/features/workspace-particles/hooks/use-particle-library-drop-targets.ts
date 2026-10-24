"use client"
import { useCallback, useContext, useEffect, useRef, type RefObject } from "react"
import { ParticleLibraryDragContext, type ParticleLibraryDragItem } from "../components/particle-library-drag-context"

export type ParticleLibraryDropHandler = (item: ParticleLibraryDragItem) => Promise<boolean> | boolean
export function useParticleLibraryDropTargets() {
  const targets = useRef(new Map<HTMLElement, ParticleLibraryDropHandler>())
  const hovered = useRef<HTMLElement | null>(null)
  const clearHover = useCallback(() => {
    hovered.current?.removeAttribute("data-library-drag-over")
    hovered.current = null
  }, [])
  const registerDropTarget = useCallback((element: HTMLElement, handler: ParticleLibraryDropHandler) => {
    targets.current.set(element, handler)
    return () => { targets.current.delete(element); if (hovered.current === element) clearHover() }
  }, [clearHover])
  const find = useCallback((hit: Element | null) => [...targets.current].find(([element]) => hit && element.contains(hit)), [])
  const hover = useCallback((hit: Element | null) => {
    const target = find(hit)?.[0] ?? null
    if (target === hovered.current) return
    clearHover(); hovered.current = target
    target?.setAttribute("data-library-drag-over", "true")
  }, [clearHover, find])
  return { registerDropTarget, find, hover, clearHover }
}

export function useParticleLibraryDropTarget(ref: RefObject<HTMLElement | null>, onDrop: ParticleLibraryDropHandler) {
  const controller = useContext(ParticleLibraryDragContext)
  const latest = useRef(onDrop)
  latest.current = onDrop
  const register = controller?.registerDropTarget
  useEffect(() => {
    if (ref.current && register) return register(ref.current, item => latest.current(item))
  }, [ref, register])
}
