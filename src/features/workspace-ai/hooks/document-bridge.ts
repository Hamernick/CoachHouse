"use client"

import { useEffect, useId, useRef, useSyncExternalStore } from "react"
import { createAiDocumentRegistry,type AiDocumentBridge,type AiDocumentEditor } from "../lib/document-registry"

export type { AiDocumentBridge } from "../lib/document-registry"
const registry=createAiDocumentRegistry()
const empty:readonly AiDocumentEditor[]=[]
export function useAiDocumentEditors() { return useSyncExternalStore(registry.subscribe,registry.snapshot,()=>empty) }

export function useAiDocumentBridge(bridge: AiDocumentBridge | null) {
  const id = useId()
  const apply = useRef(bridge?.apply)
  apply.current = bridge?.apply
  const target = bridge?.target
  const dirty = bridge?.dirty
  const saving = bridge?.saving
  const content = bridge?.content
  const application = bridge?.application
  useEffect(() => {
    registry.update(id,target && content !== undefined && dirty !== undefined && saving !== undefined
      ? {target,dirty,saving,content,application,apply:proposal=>apply.current?.(proposal) ?? false} : null)
  },[id,target,dirty,saving,content,application])
  // Value updates must not unregister/re-register the selected editor: that
  // transient gap used to reset in-progress composer state while typing/saving.
  useEffect(()=>()=>registry.update(id,null),[id])
}
