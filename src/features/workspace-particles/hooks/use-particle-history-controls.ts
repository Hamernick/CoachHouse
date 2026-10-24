"use client"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react"
import { toast } from "@/lib/toast"
import {
  particleHistoryShortcut,
  type ParticleHistoryDirection,
} from "../lib/particle-history"
import type { useParticleSession } from "./use-particle-session"

type Input = {
  session: ReturnType<typeof useParticleSession>
  flush: () => Promise<boolean>
  dirty: RefObject<boolean>
  blocked: boolean
}

export function useParticleHistoryControls(input: Input) {
  const latest = useRef(input)
  latest.current = input
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const run = useCallback(async (direction: ParticleHistoryDirection) => {
    const current = latest.current
    if (running.current || current.blocked || !current.session.editable)
      return false
    if (current.dirty.current) {
      toast.error(
        "Save or discard the open Particle edits before undoing or redoing."
      )
      return false
    }
    running.current = true
    setBusy(true)
    setMessage(null)
    try {
      if (!(await current.flush())) return false
      const next = latest.current
      if (
        next.blocked ||
        next.dirty.current ||
        next.session.graph?.workspaceId !== current.session.graph?.workspaceId
      )
        return false
      const applied = await next.session.travel(direction)
      if (applied) {
        const graph = next.session.getCurrentGraph()
        if (
          next.session.selectedId &&
          !graph?.particles.some(
            (item) => item.id === next.session.selectedId && !item.canvasHidden
          )
        )
          next.session.select(null)
        setMessage(
          direction === "undo"
            ? "Particle change undone."
            : "Particle change redone."
        )
      }
      return applied
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const direction = particleHistoryShortcut({
        ...event,
        isComposing: event.nativeEvent.isComposing,
      })
      if (!direction) return false
      event.preventDefault()
      event.stopPropagation()
      void run(direction)
      return true
    },
    [run]
  )
  return useMemo(
    () => ({
      busy,
      message,
      onKeyDown,
      undoLabel: input.session.undoLabel,
      redoLabel: input.session.redoLabel,
      undo: () => run("undo"),
      redo: () => run("redo"),
    }),
    [
      busy,
      message,
      onKeyDown,
      input.session.undoLabel,
      input.session.redoLabel,
      run,
    ]
  )
}
