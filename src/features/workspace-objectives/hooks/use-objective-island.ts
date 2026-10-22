"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ObjectiveIslandData, ObjectiveIslandTransport, ObjectiveMutationResult, ObjectiveScope } from "../island-types"

export function useObjectiveIsland(scope: ObjectiveScope, transport: ObjectiveIslandTransport) {
  const [data, setData] = useState<ObjectiveIslandData | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(false)
  const lock = useRef(false)
  const request = useRef({ version: 0 })
  useEffect(() => { const lifecycle = request.current; alive.current = true; return () => { alive.current = false; lifecycle.version++ } }, [])
  const load = useCallback(async () => {
    const version = ++request.current.version
    const result = await transport.load(scope).catch(() => ({ ok: false as const, error: "Unable to load objectives. Try again." }))
    if (!alive.current || version !== request.current.version) return false
    if (!result.ok) { setError(result.error); return false }
    setData(result.data); setError(null); return true
  }, [scope, transport])
  const refresh = useCallback(async () => {
    if (lock.current) return
    lock.current = true; setPending(true)
    try { await load() } finally { lock.current = false; if (alive.current) setPending(false) }
  }, [load])
  const mutate = useCallback(async (operation: () => Promise<ObjectiveMutationResult>) => {
    if (lock.current) return false
    lock.current = true; setPending(true); setError(null)
    try {
      const result = await operation()
      if (!alive.current) return false
      if (!result.ok) { setError(result.error); return false }
      // A refresh failure is not a mutation failure: don't invite duplicate creation.
      const loaded = await load()
      if (!loaded && alive.current) setError("Saved. Reopen Objectives to load the latest changes.")
      return true
    } catch {
      if (alive.current) setError("The result could not be confirmed. Reopen Objectives before trying again.")
      return false
    } finally { lock.current = false; if (alive.current) setPending(false) }
  }, [load])
  return { data, pending, error, refresh, mutate }
}
