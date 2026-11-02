"use client"
import { toast } from "@/lib/toast"
import { useEffect } from "react"
import { OPEN_OPPORTUNITY, opportunityId } from "../lib/opportunity-navigation"
import type { WorkspaceFinanceOpportunityInput } from "../types"

export function useOpportunityCalendarTarget(items: WorkspaceFinanceOpportunityInput[], organizationId: string | undefined, open: (item: WorkspaceFinanceOpportunityInput) => void, enabled: boolean) {
  useEffect(() => {
    if (!organizationId) return
    const reveal = (id: unknown) => {
      if (!opportunityId(id)) return false
      const item = items.find(item => item.id === id && item.status !== "dismissed")
      if (!item) return false
      open(item)
      return true
    }
    const listener = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.orgId !== organizationId) return
      if (!enabled) { event.preventDefault(); toast.error("Finish editing this opportunity first."); return }
      if (reveal(event.detail.id)) event.preventDefault()
    }
    window.addEventListener(OPEN_OPPORTUNITY, listener)
    const url = new URL(window.location.href)
    const target = url.searchParams.get("opportunity")
    if (enabled && target && reveal(target)) {
      url.searchParams.delete("opportunity")
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
    }
    return () => window.removeEventListener(OPEN_OPPORTUNITY, listener)
  }, [items, organizationId, open, enabled])
}
