"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { dataViewPageSchema, type DataViewCommand, type DataViewPage } from "../lib/schema"
import { runDataViewCommand } from "../source-actions"

export function useWorkspaceDataViewsController(organizationId: string, viewId: string) {
  const [data, setData] = useState<DataViewPage | null>(null)
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState<DataViewCommand | null>(null)
  const generation = useRef(0)
  const busy = useRef(false)
  const load = useCallback(async () => {
    const current = ++generation.current
    const result = await runDataViewCommand({ action: "read", organizationId, viewId, page })
    if (current !== generation.current) return false
    if (!result.ok) {
      setError(result.error)
      // Revocation/unavailability clears cached rows and counts immediately.
      setData(null)
      return false
    }
    const parsed = dataViewPageSchema.safeParse(result.data)
    if (!parsed.success) { setData(null); setError("The saved view is unavailable. Try reloading."); return false }
    setData(parsed.data)
    return true
  }, [organizationId, viewId, page])
  useEffect(() => { const ticket = generation; void load(); return () => { ticket.current++ } }, [load])
  const mutate = useCallback(async (command: DataViewCommand) => {
    if (busy.current) return false
    busy.current = true; setPending(true); setError(null)
    try {
      const result = await runDataViewCommand(command)
      if (!result.ok) {
        setError(result.error)
        setUncertain(result.code === "unavailable" ? command : null)
        if (result.code === "denied") setData(null)
        return false
      }
      setUncertain(null)
      await load()
      return true
    } finally { busy.current = false; setPending(false) }
  }, [load])
  return { data, page, setPage, pending, error, setError, uncertain, load, mutate }
}
