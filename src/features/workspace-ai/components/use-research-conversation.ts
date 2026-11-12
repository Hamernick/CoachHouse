"use client"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { getWorkspaceConversation, updateWorkspaceConversation } from "../conversation-actions"
import type { NewObjectiveTarget, ResearchTarget } from "../research-types"
import type { ChatMutation, ResearchConversationEntry, ResearchConversationTurn } from "../lib/research-conversation"

export function useResearchConversation(target: NewObjectiveTarget, enabled: boolean, onRestore: (id: string, automatic: boolean, target?: ResearchTarget) => void) {
  const [entries, setEntries] = useState<ResearchConversationEntry[]>([])
  const [turns, setTurns] = useState<ResearchConversationTurn[]>([])
  const [rootId, setRootId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [beforeTurn, setBeforeTurn] = useState<number | null>(null)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const paging = useRef(false), loadedPages = useRef(1)
  const mutation = useRef(false), refreshing = useRef(false)
  const recorded = useRef(new Map<string, string>())
  const epoch = useRef(0), alive = useRef(false), root = useRef<string | null>(null)
  const latestTarget = useRef(target); latestTarget.current = target
  const restore = useRef(onRestore); restore.current = onRestore
  async function refresh(options: { id?: string; rootId?: string; restore?: boolean; automatic?: boolean } = {}) {
    const version = ++epoch.current
    refreshing.current = true
    setLoading(true); setError(null)
    if (options.rootId && options.rootId !== root.current) { root.current = options.rootId; setRootId(options.rootId); setTurns([]); setBeforeTurn(null); loadedPages.current = 1 }
    try {
      const list = options.rootId ? { entries } : await getWorkspaceConversation(latestTarget.current)
      if (!alive.current || version !== epoch.current) return
      if ("error" in list) throw new Error(list.error)
      setEntries(list.entries)
      const selected = options.rootId ?? (options.id ? list.entries.find(entry => entry.id === options.id)?.rootId : root.current)
        ?? (options.restore ? list.entries.at(-1)?.rootId : undefined)
      if (!selected) return
      const reply = await getWorkspaceConversation(latestTarget.current, selected)
      if (!alive.current || version !== epoch.current) return
      if ("error" in reply || !reply.turns) throw new Error("Chat unavailable")
      let restored = reply.turns, cursor = reply.beforeTurn ?? null
      // Focus revalidation covers every displayed page, not just the latest page.
      for (let page = 1; page < loadedPages.current && cursor; page += 1) {
        const older = await getWorkspaceConversation(latestTarget.current, selected, cursor)
        if (!alive.current || version !== epoch.current) return
        if ("error" in older || !older.turns) throw new Error("Chat unavailable")
        restored = [...older.turns, ...restored]; cursor = older.beforeTurn ?? null
      }
      root.current = selected; setRootId(selected); setTurns(restored); setBeforeTurn(cursor)
      if (options.restore && reply.entries.at(-1)) restore.current(reply.entries.at(-1)!.id, Boolean(options.automatic), reply.turns.at(-1)?.target)
    } catch { if (options.id) recorded.current.delete(options.id); if (alive.current && version === epoch.current) { setTurns([]); setBeforeTurn(null); setError("Chat could not be loaded. Retry.") } }
    finally { if (alive.current && version === epoch.current) { refreshing.current = false; setLoading(false) } }
  }
  const reload = useEffectEvent(() => { if (!refreshing.current && !mutation.current) void refresh() })
  const initial = useEffectEvent(() => { void refresh({ restore: true, automatic: true }) })
  useEffect(() => {
    alive.current = true
    if (enabled) initial()
    let timer: ReturnType<typeof setTimeout> | undefined
    const visibility = () => {
      clearTimeout(timer)
      // Focus and visibilitychange often arrive together. Revalidate in place;
      // only a rejected read or a different chat should remove verified turns.
      if (enabled && document.visibilityState === "visible") {
        const scheduledVersion = epoch.current
        timer = setTimeout(() => { if (scheduledVersion === epoch.current) reload() }, 100)
      }
    }
    window.addEventListener("focus", visibility)
    document.addEventListener("visibilitychange", visibility)
    return () => { clearTimeout(timer); alive.current = false; epoch.current += 1; window.removeEventListener("focus", visibility); document.removeEventListener("visibilitychange", visibility) }
  }, [enabled])
  async function loadEarlier() {
    if (paging.current || loading || !beforeTurn || !root.current) return false
    paging.current = true; setLoadingEarlier(true)
    const version = epoch.current, selected = root.current
    try {
      const reply = await getWorkspaceConversation(latestTarget.current, selected, beforeTurn)
      if (!alive.current || version !== epoch.current || selected !== root.current) return false
      if ("error" in reply || !reply.turns) throw new Error("Chat unavailable")
      setTurns(current => [...reply.turns!, ...current.filter(turn => !reply.turns!.some(older => older.id === turn.id))])
      setBeforeTurn(reply.beforeTurn ?? null); loadedPages.current += 1; setError(null)
      return true
    } catch {
      if (alive.current && version === epoch.current) { setTurns([]); setBeforeTurn(null); setError("Chat could not be loaded. Retry.") }
      return false
    } finally { paging.current = false; if (alive.current) setLoadingEarlier(false) }
  }
  async function update(change: ChatMutation): Promise<string | null> {
    if (mutation.current) return "A chat update is already in progress."
    mutation.current = true; setMutating(true)
    try {
      const reply = await updateWorkspaceConversation(latestTarget.current, change)
      if ("error" in reply) return reply.error
      if (!alive.current) return null
      epoch.current += 1; refreshing.current = false; setLoading(false)
      if (change.action === "delete" && root.current === change.rootId) {
        root.current = null; setRootId(null); setTurns([]); setBeforeTurn(null); loadedPages.current = 1
      }
      const list = await getWorkspaceConversation(latestTarget.current)
      if (alive.current) {
        if ("error" in list) setError("Chat list could not be refreshed. Retry.")
        else { setEntries(list.entries); setError(null) }
      }
      return null
    } catch { return "Chat could not be updated. Reload and retry." }
    finally { mutation.current = false; if (alive.current) setMutating(false) }
  }
  return { entries, turns, rootId, error, loading, mutating, update, beforeTurn, loadingEarlier, loadEarlier,
    show: (id: string) => {
      const entry = entries.find(entry => entry.rootId === id)
      if (entry) restore.current(entry.id, false, entry.target)
      if (root.current === id && refreshing.current) return Promise.resolve()
      return refresh({ rootId: id, restore: !entry })
    },
    record: (id: string, status: string) => {
      // Restoring a turn already read by history must not clear/re-fetch it.
      if (recorded.current.get(id) === status || entries.some(entry => entry.id === id && entry.status === status)) return Promise.resolve()
      recorded.current.set(id, status)
      return refresh({ id }).then(() => {
        // A failed read must remain retryable; repeated receipts are otherwise inert.
        if (!alive.current) recorded.current.delete(id)
      })
    },
    retry: () => refresh(),
    clear: () => { epoch.current += 1; refreshing.current = false; root.current = null; setRootId(null); setTurns([]); setBeforeTurn(null); loadedPages.current = 1; setLoading(false); setError(null) },
  }
}
