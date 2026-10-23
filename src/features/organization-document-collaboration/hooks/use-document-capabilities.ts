"use client"
import { useCallback, useEffect, useState } from "react"
import type { DocumentCapabilities } from "@/lib/organization/document-capability-types"

export function useDocumentCapabilities(organizationId: string) {
  const [state, setState] = useState<{ organizationId: string; capabilities?: DocumentCapabilities; error?: string }>({ organizationId })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timer = setTimeout(() => controller.abort(), 10_000)
    setState({ organizationId })
    void fetch(`/api/account/document-capabilities?organizationId=${encodeURIComponent(organizationId)}`, {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "x-coach-house-organization-id": organizationId },
    }).then(async response => {
      const result = await response.json()
      if (!response.ok || !result.capabilities) throw new Error("Access unavailable")
      if (active) setState({ organizationId, capabilities: result.capabilities })
    }).catch(() => { if (active) setState({ organizationId, error: "Unable to check document access. Try again." }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [organizationId, attempt])
  const current = state.organizationId === organizationId ? state : { organizationId }
  return { ...current, loading: !current.capabilities && !current.error, retry }
}
