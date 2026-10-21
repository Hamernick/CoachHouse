"use client"

import {
  useContext,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  ParticleLibraryDragContext,
  type ParticleLibraryDragItem,
} from "../components/particle-library-drag-context"
import { createParticleDragGesture } from "../lib/particle-drag-gesture"
import { toast } from "@/lib/toast"

export function useParticleLibraryDragSource(
  getItem: () => ParticleLibraryDragItem,
  disabled: boolean
) {
  const controller = useContext(ParticleLibraryDragContext)
  const cleanup = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => () => cleanup.current?.(), [])
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !controller ||
      controller.enabled === false ||
      disabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      document.documentElement.hasAttribute("data-react-grab-inspecting")
    )
      return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest("input,textarea,select,[contenteditable=true]")) return
    const button = target.closest("button,a")
    if (button && !button.hasAttribute("data-particle-drag-surface")) return
    if (
      event.pointerType === "touch" &&
      !target.closest("[data-particle-touch-drag]")
    )
      return
    cleanup.current?.()
    const source = event.currentTarget
    const id = event.pointerId
    const gesture = createParticleDragGesture({
      origin: { x: event.clientX, y: event.clientY },
      begin: () => {
        let started = false
        try {
          started = controller.begin(getItem(), source, {
            x: event.clientX,
            y: event.clientY,
          })
        } catch {
          toast.error(
            "Unable to drag this item. Reload its library and try again."
          )
        }
        if (started) {
          suppressClick.current = true
          source.setPointerCapture(id)
        }
        return started
      },
      move: controller.move,
      drop: controller.drop,
      cancel: controller.cancel,
    })
    const dispose = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", key, true)
      window.removeEventListener("blur", cancel)
      if (source.hasPointerCapture(id)) source.releasePointerCapture(id)
      cleanup.current = null
    }
    const move = (next: PointerEvent) => {
      if (next.pointerId !== id) return
      gesture.move({ x: next.clientX, y: next.clientY })
      if (gesture.active) next.preventDefault()
    }
    const up = (next: PointerEvent) => {
      if (next.pointerId !== id) return
      gesture.end({ x: next.clientX, y: next.clientY })
      dispose()
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    const cancel = () => {
      gesture.cancel()
      dispose()
      suppressClick.current = false
    }
    const key = (next: KeyboardEvent) => {
      if (next.key === "Escape") {
        next.preventDefault()
        next.stopPropagation()
        cancel()
      }
    }
    cleanup.current = cancel
    window.addEventListener("pointermove", move, { passive: false })
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", key, true)
    window.addEventListener("blur", cancel)
  }
  return {
    available: Boolean(controller) && controller?.enabled !== false,
    onPointerDown,
    onClickCapture(
      event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>
    ) {
      if (suppressClick.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }
}
