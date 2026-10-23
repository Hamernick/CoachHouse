"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { workspacePresenceOverHttp } from "../lib/presence-transport"
import { startBackgroundPolling } from "@/lib/background-polling"
import type { WorkspaceSupportParticipant } from "../types"

export function useOrganizationWorkspaceSupportController(organizationId: string, supportAccess: boolean) {
  const path = usePathname()
  const [participants, setParticipants] = useState<WorkspaceSupportParticipant[]>([])
  const [error, setError] = useState<string | null>(null)
  const session = useRef<string>("")
  useEffect(() => {
    if (!organizationWorkspaceSupportEnabled) return
    session.current = crypto.randomUUID()
    const lifetime = new AbortController()
    const sessionId = session.current
    let stopped = false
    let targetUnavailable = false
    let position: { x: number; y: number } | null = null
    let editedAt = 0
    const pointer = (event: PointerEvent) => {
      position = { x: Math.max(0, Math.min(1, event.clientX / window.innerWidth)), y: Math.max(0, Math.min(1, event.clientY / window.innerHeight)) }
    }
    const editing = () => { editedAt = Date.now() }
    const tick = async () => {
      if (stopped) return
      try {
        const result = await workspacePresenceOverHttp({ organizationId, sessionId,
          path, position: document.visibilityState === "visible" ? position : null,
          editing: supportAccess && Date.now() - editedAt < 3000 }, lifetime.signal)
        if (stopped) return
        if ("error" in result) {
          targetUnavailable = result.code === "organization_unavailable" && result.retryable === false
          setError(result.error ?? "Live support presence is unavailable."); setParticipants([]); return false
        }
        setError(null); setParticipants(result.participants ?? [])
        return true
      } catch { if (!stopped) { setError("Live support presence is reconnecting."); setParticipants([]) }; return false }
    }
    if (supportAccess) {
      window.addEventListener("pointermove", pointer, { passive: true })
      window.addEventListener("input", editing, true)
    }
    // The existing support authorization lease is 15s. A 5s heartbeat plus its
    // 5s HTTP deadline stays within that lease; hidden support tabs retain it.
    const stopPolling = startBackgroundPolling({ run: tick, intervalMs: () => 5000,
      enabled: () => !targetUnavailable && (supportAccess || document.visibilityState === "visible") })
    return () => {
      stopped = true
      stopPolling()
      lifetime.abort()
      window.removeEventListener("pointermove", pointer)
      window.removeEventListener("input", editing, true)
      void workspacePresenceOverHttp({ organizationId, sessionId, path, position: null, editing: false, leave: true })
    }
  }, [organizationId, supportAccess, path])
  return { participants, error, sessionId: session.current, path }
}
