"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ComposerContextResult } from "@/lib/workspace/composer-context"
import { listWorkspaceComposerContext } from "../context-actions"
import type { NewObjectiveTarget } from "../research-types"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"

const MAX_AGE = 30_000

class ContextCache {
  private valid = true
  private epoch = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  readonly results = new Map<string, { value: ComposerContextResult; expires: number }>()
  readonly pending = new Map<string, Promise<ComposerContextResult>>()
  constructor(readonly target: NewObjectiveTarget, readonly generation: number) {}
  currentEpoch() { return this.epoch }
  isCurrent(epoch = this.epoch) { return this.valid && epoch === this.epoch }
  activate() { this.valid = true }
  clear() {
    this.valid = false
    this.epoch += 1
    this.results.clear()
    this.pending.clear()
    clearTimeout(this.timer)
    this.timer = undefined
  }
  expire(invalidate: () => void) {
    if (!this.timer) this.timer = setTimeout(invalidate, MAX_AGE)
  }
}

/** Display metadata only. Selected evidence is separately authorized on submit. */
export function useComposerContextCache({ organizationId, canvasId, revision }: NewObjectiveTarget) {
  const [generation, setGeneration] = useState(0)
  const cache = useMemo(() => new ContextCache({ mode: "new_objective", organizationId, canvasId, revision }, generation),
    [organizationId, canvasId, revision, generation])
  const invalidate = useCallback(() => {
    if (!cache.isCurrent()) return
    cache.clear()
    setGeneration(value => value + 1)
  }, [cache])
  useEffect(() => {
    cache.activate()
    const unsubscribeAccess = subscribeWorkspaceAccessChanged(organizationId, invalidate)
    // No polling while closed. Expiration clears metadata; only an open picker
    // requests a fresh list. Focus/visibility events also cover another tab's edits.
    window.addEventListener("focus", invalidate)
    window.addEventListener("online", invalidate)
    window.addEventListener("pagehide", invalidate)
    document.addEventListener("visibilitychange", invalidate)
    return () => {
      cache.clear()
      window.removeEventListener("focus", invalidate)
      window.removeEventListener("online", invalidate)
      window.removeEventListener("pagehide", invalidate)
      document.removeEventListener("visibilitychange", invalidate)
      unsubscribeAccess()
    }
  }, [cache, invalidate, organizationId])
  const getCached = useCallback((query: string) => {
    const entry = cache.results.get(query.trim().toLocaleLowerCase())
    if (cache.isCurrent() && entry && entry.expires > Date.now()) return entry.value
  }, [cache])
  const search = useCallback((query: string): Promise<ComposerContextResult> => {
    if (!cache.isCurrent() || document.visibilityState === "hidden") return Promise.reject(new Error("Context needs refreshing."))
    const key = query.trim().toLocaleLowerCase(), cached = getCached(key)
    if (cached) return Promise.resolve(cached)
    const pending = cache.pending.get(key)
    if (pending) return pending
    const epoch = cache.currentEpoch()
    const request = listWorkspaceComposerContext(cache.target, key).then(value => {
      // A request admitted before scope/lifecycle invalidation cannot repopulate
      // either the cache or the menu's own response state afterward.
      if (!cache.isCurrent(epoch)) throw new Error("Context needs refreshing.")
      cache.expire(invalidate)
      if (!value.unavailable.length) {
        cache.results.set(key, { value, expires: Date.now() + MAX_AGE })
        if (cache.results.size > 20) cache.results.delete(cache.results.keys().next().value!)
      }
      return value
    }).finally(() => { if (cache.pending.get(key) === request) cache.pending.delete(key) })
    cache.pending.set(key, request)
    return request
  }, [cache, getCached, invalidate])
  return { search, getCached }
}
