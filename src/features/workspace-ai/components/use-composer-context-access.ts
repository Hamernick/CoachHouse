"use client"

import { useEffect, useRef, useState, type MutableRefObject } from "react"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import type { ComposerContextAccess, ComposerContextSelection } from "@/lib/workspace/composer-context"
import { revalidateWorkspaceComposerContext } from "../context-actions"
import type { NewObjectiveTarget } from "../research-types"

const key = (item: ComposerContextSelection) => JSON.stringify([item.id, item.revision, item.token, item.title])

/** Session-local authority for inline atoms, including atoms restored by Undo. */
export function useComposerContextAccess(target: NewObjectiveTarget, current: MutableRefObject<ComposerContextSelection[]>,
  set: (items: ComposerContextSelection[]) => void, onInvalidated: (sanitize: (value: string) => string) => void) {
  const known = useRef(new Map<string, ComposerContextSelection>())
  const allowed = useRef(new Set<string>())
  const checking = useRef(false)
  const epoch = useRef(0)
  const [state, publish] = useState({ version: 0, checking: false })
  const latest = useRef({ set, onInvalidated })
  latest.current = { set, onInvalidated }
  const allows = (item: ComposerContextSelection) => allowed.current.has(key(item))
  const sanitize = (value: string) => {
    const permitted = new Set([...known.current].filter(([id]) => allowed.current.has(id)).map(([, item]) => item.token))
    for (const [id, item] of known.current) {
      if (!allowed.current.has(id) && !permitted.has(item.token)) value = value.split(item.token).join("")
    }
    return value
  }
  const { organizationId, canvasId, revision } = target
  useEffect(() => {
    let active = true
    let inFlight = false
    const refresh = (force = false) => {
      if (!active || (inFlight && !force)) return
      const version = ++epoch.current
      const snapshot = current.current
      // Removed mentions in history cease to be trusted at every access boundary.
      allowed.current = new Set(snapshot.map(key))
      latest.current.onInvalidated(sanitize)
      checking.current = snapshot.length > 0
      publish(previous => ({ version: previous.version + 1, checking: checking.current }))
      if (!snapshot.length || document.visibilityState === "hidden") { inFlight = false; return }
      inFlight = true
      const finish = (valid: { id: string; revision: string | null }[]) => {
        if (!active || version !== epoch.current) return
        const kept = new Set(snapshot.filter(item => valid.some(ref => ref.id === item.id && ref.revision === item.revision)).map(key))
        allowed.current = kept
        latest.current.set(current.current.filter(item => kept.has(key(item))))
        latest.current.onInvalidated(sanitize)
        checking.current = false; inFlight = false
        publish(previous => ({ version: previous.version + 1, checking: false }))
      }
      void revalidateWorkspaceComposerContext({ mode: "new_objective", organizationId, canvasId, revision },
        snapshot.map(({ id, revision }) => ({ id, revision }))).then(finish, () => finish([]))
    }
    const lifecycle = () => refresh()
    const accessChanged = () => refresh(true)
    const unsubscribe = subscribeWorkspaceAccessChanged(organizationId, accessChanged)
    window.addEventListener("focus", lifecycle)
    window.addEventListener("online", accessChanged)
    window.addEventListener("pagehide", accessChanged)
    document.addEventListener("visibilitychange", accessChanged)
    refresh(true)
    return () => {
      active = false; epoch.current += 1
      unsubscribe()
      window.removeEventListener("focus", lifecycle)
      window.removeEventListener("online", accessChanged)
      window.removeEventListener("pagehide", accessChanged)
      document.removeEventListener("visibilitychange", accessChanged)
    }
    // Mutable selection/handlers are read at the boundary, never on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, canvasId, revision])
  const access: ComposerContextAccess = { ...state, allows, sanitize }
  return { access, admit(item: ComposerContextSelection) {
    if (checking.current) throw new Error("Context needs refreshing.")
    known.current.set(key(item), item); allowed.current.add(key(item))
  } }
}
