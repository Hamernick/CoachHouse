"use client"

import { useEffect, useId, useRef, useSyncExternalStore } from "react"
import type { AiDocumentTarget, AiDocumentProposal } from "../types"

export type AiDocumentBridge = {
  target: AiDocumentTarget
  dirty: boolean
  saving: boolean
  content: string
  apply: (proposal: AiDocumentProposal) => boolean
}
// An ephemeral bridge to the mounted editor, not another document store.
// Never persists private content or survives a full page/account navigation.
const editors = new Map<string,AiDocumentBridge>()
const listeners = new Set<() => void>()
let current: AiDocumentBridge | null = null
function emit() { current = [...editors.values()].at(-1) ?? null; listeners.forEach(listener => listener()) }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useAiDocumentTarget() { return useSyncExternalStore(subscribe,() => current,() => null) }

export function useAiDocumentBridge(bridge: AiDocumentBridge | null) {
  const id = useId()
  const apply = useRef(bridge?.apply)
  apply.current = bridge?.apply
  const target = bridge?.target
  const dirty = bridge?.dirty
  const saving = bridge?.saving
  const content = bridge?.content
  useEffect(() => {
    if (!target || content === undefined || dirty === undefined || saving === undefined) return
    editors.set(id,{ target, dirty, saving, content, apply: proposal => apply.current?.(proposal) ?? false })
    emit()
    return () => { editors.delete(id); emit() }
  },[id,target,dirty,saving,content])
}
