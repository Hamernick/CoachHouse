"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { collectionIdsAfterChange, HOME_COLLECTION_KEY, parsePendingHomeCollection, type HomeResource, type PendingHomeCollection } from "../lib/home-resource-preview"

type Collection = { favorites: string[]; collectedResourceIds: string[] }
const EMPTY: Collection = { favorites: [], collectedResourceIds: [] }

async function readCollection(signal?: AbortSignal): Promise<Collection> {
  const response = await fetch("/api/account/map-preferences", { cache: "no-store", signal })
  if (!response.ok) throw new Error("Could not load your collection. Please retry.")
  const data = await response.json()
  return { favorites: data.preferences.favorites, collectedResourceIds: data.preferences.collectedResourceIds }
}

export function useHomeResourceCollection(onRestoreQuery: (query: string) => void) {
  const supabase = useSupabaseClient()
  const [viewer, setViewer] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [collection, setCollection] = useState<Collection>(EMPTY)
  const [pending, setPending] = useState<PendingHomeCollection | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [retryVersion, setRetryVersion] = useState(0)
  const failedSave = useRef<{ item: Pick<HomeResource, "id" | "kind">; collect: boolean; finishPending: boolean } | null>(null)
  const busy = useRef(false)
  const activeUser = useRef<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const params = new URLSearchParams(window.location.search)
    let stored: string | null = null
    try { stored = localStorage.getItem(HOME_COLLECTION_KEY) } catch { /* The confirmation URL also retains the pending action. */ }
    const restored = parsePendingHomeCollection(params.get("homeCollect")) ?? parsePendingHomeCollection(stored)
    if (restored) { setPending(restored); onRestoreQuery(restored.query); setAuthOpen(true) }
    else if (params.has("homeSearch")) onRestoreQuery((params.get("homeSearch") ?? "").slice(0, 160))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      activeUser.current = session?.user.id ?? null
      setViewer((previous) => previous?.id === session?.user.id ? previous : session?.user ?? null)
      setAuthReady(true)
    })
    return () => { alive.current = false; activeUser.current = null; data.subscription.unsubscribe() }
  }, [supabase, onRestoreQuery])

  useEffect(() => {
    setLoaded(false)
    setCollection(EMPTY)
    if (!viewer) return
    setAuthOpen(false)
    failedSave.current = null
    const controller = new AbortController()
    void readCollection(controller.signal).then((value) => {
      if (controller.signal.aborted) return
      setCollection(value); setLoaded(true); setError(null); setAuthOpen(false)
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [viewer, retryVersion])

  const clearPending = useCallback(() => {
    setPending(null)
    try { localStorage.removeItem(HOME_COLLECTION_KEY) } catch { /* Optional recovery storage. */ }
    const url = new URL(window.location.href)
    if (url.searchParams.has("homeCollect")) {
      url.searchParams.delete("homeCollect")
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
    }
  }, [])

  const save = useCallback(async (item: Pick<HomeResource, "id" | "kind">, collect: boolean, finishPending = false) => {
    const userId = activeUser.current
    if (!userId || busy.current) return
    busy.current = true; setSaving(true); setError(null)
    failedSave.current = { item, collect, finishPending }
    try {
      // Read before changing only this collection field; preserve unrelated preferences.
      const current = await readCollection()
      if (activeUser.current !== userId || !alive.current) return
      const field = item.kind === "organization" ? "favorites" : "collectedResourceIds"
      const ids = collectionIdsAfterChange(current[field], item.id, collect)
      const response = await fetch("/api/account/map-preferences", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: ids }),
      })
      if (!response.ok) throw new Error("Could not save your collection. Please retry.")
      const data = await response.json()
      if (activeUser.current !== userId || !alive.current) return
      setCollection({ favorites: data.preferences.favorites, collectedResourceIds: data.preferences.collectedResourceIds })
      failedSave.current = null
      setNotice(collect ? "Collected" : "Removed from collection")
      if (finishPending) clearPending()
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "Could not save your collection.")
    } finally { busy.current = false; if (alive.current) setSaving(false) }
  }, [clearPending])

  useEffect(() => {
    if (viewer && loaded && pending) void save(pending, true, true)
  }, [viewer, loaded, pending, save])

  const isCollected = (item: Pick<HomeResource, "id" | "kind">) => collection[item.kind === "organization" ? "favorites" : "collectedResourceIds"].includes(item.id)
  const toggle = (item: HomeResource, query: string) => {
    if (!authReady || busy.current) return
    if (viewer) { if (loaded) void save(item, !isCollected(item)); return }
    const next = { id: item.id, kind: item.kind, query, createdAt: Date.now() }
    setPending(next); setAuthOpen(true); setError(null)
    try { localStorage.setItem(HOME_COLLECTION_KEY, JSON.stringify(next)) } catch { /* Return URL preserves confirmation state. */ }
  }
  const authenticated = useCallback(() => {
    // Auth events also cover email confirmation in another tab. No route reload needed.
    void supabase.auth.getSession().then(({ data }) => {
      activeUser.current = data.session?.user.id ?? null
      setViewer((previous) => previous?.id === data.session?.user.id ? previous : data.session?.user ?? null)
    })
  }, [supabase])
  return {
    viewer, authReady, loaded, collection, pending, authOpen, saving, error, notice, isCollected, toggle, authenticated,
    openAuth: () => setAuthOpen(true),
    closeAuth: () => { setAuthOpen(false); clearPending() },
    retry: () => {
      const failed = failedSave.current
      if (loaded && failed) void save(failed.item, failed.collect, failed.finishPending)
      else if (loaded && pending) void save(pending, true, true)
      else setRetryVersion((value) => value + 1)
    },
  }
}
