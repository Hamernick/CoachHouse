"use client"

import { useCallback, useMemo, useRef, useState, type RefObject } from "react"

// Preserve the synchronous navigation contract; a confirmed dialog resumes only
// the accepted destination. Cancel never clears the editor or its dirty flag.
export function useParticleCloseGuard({ dirty, close, selectionId, discardBlocked }: {
  dirty: RefObject<boolean>
  close: (restoreFocus?: boolean) => boolean
  selectionId: string | null
  discardBlocked: boolean
}) {
  const [open, setOpen] = useState(false)
  const latest = useRef({ dirty, close, selectionId, discardBlocked })
  latest.current = { dirty, close, selectionId, discardBlocked }
  const pending = useRef<{ selectionId: string | null; resume?: () => void } | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const cancel = useCallback(() => { pending.current = null; setOpen(false) }, [])
  const request = useCallback((resume?: () => void) => {
    const current = latest.current
    if (!current.selectionId || !current.dirty.current || current.discardBlocked) return current.close(!resume)
    returnFocus.current = typeof document !== "undefined" && typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null
    pending.current = { selectionId: current.selectionId, resume }
    setOpen(true)
    return false
  }, [])
  const discard = useCallback(() => {
    const intent = pending.current
    const current = latest.current
    if (!intent) return
    cancel()
    if (intent.selectionId !== current.selectionId || current.discardBlocked) return
    const wasDirty = current.dirty.current
    current.dirty.current = false
    if (current.close(!intent.resume)) intent.resume?.()
    else current.dirty.current = wasDirty
  }, [cancel])
  return useMemo(() => ({ open, request, cancel, discard, returnFocus }), [open, request, cancel, discard])
}
