"use client"
import { useRef, useState } from "react"
import type { ComposerContextControl, ComposerContextItem, ComposerContextSelection } from "@/lib/workspace/composer-context"
import { useComposerContextCache } from "./use-composer-context-cache"
import type { NewObjectiveTarget } from "../research-types"
import { useComposerContextAccess } from "./use-composer-context-access"

export function useComposerContext(target: NewObjectiveTarget, onInvalidated: (sanitize: (value: string) => string) => void) {
  const [selected, setSelected] = useState<ComposerContextSelection[]>([])
  const current = useRef(selected)
  current.current = selected
  const set = (items: ComposerContextSelection[]) => { current.current = items; setSelected(items) }
  const { access, admit } = useComposerContextAccess(target, current, set, onInvalidated)
  // The planning session also remounts on actor changes.
  const { search, getCached } = useComposerContextCache(target)
  const control: ComposerContextControl = { selected, search, getCached, access,
    select(item: ComposerContextItem) {
      const existing = current.current.find(value => value.id === item.id)
      if (existing) return existing
      if (current.current.length >= 10) throw new Error("Choose up to 10 context items.")
      const title = item.title.replace(/[{}\r\n]/g," ").trim()
      let token = `@{${title}}`, suffix = 2
      while (current.current.some(value => value.token === token)) token = `@{${title} · ${suffix++}}`
      const next = { ...item, token }
      admit(next)
      set([...current.current,next])
      return next
    },
    reconcile(items) { set(items.filter(access.allows)) },
    remove(id) { set(current.current.filter(item => item.id !== id)) },
  }
  return { control, retain(prompt: string) { set(current.current.filter(item => prompt.includes(item.token))) }, clear() { set([]) } }
}
