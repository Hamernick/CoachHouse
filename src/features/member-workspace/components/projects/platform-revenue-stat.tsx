"use client"

import { useEffect, useState } from "react"
import { CoachingAvatarGroup } from "@/components/coaching/coaching-avatar-group"
import { COACHING_COACHES } from "@/lib/meetings"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { loadPlatformRevenue } from "../../project-workflow-actions"

export function PlatformRevenueStat({ kind = "revenue" }: { kind?: "revenue" | "coaching" }) {
  const [scope, setScope] = useState<"all" | "subscriptions" | "joel" | "paula">("all")
  const [revenue, setRevenue] = useState<Awaited<ReturnType<typeof loadPlatformRevenue>>>()
  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return
      pending = true
      try {
        const result = await loadPlatformRevenue(kind === "coaching" ? "coaching" : scope === "subscriptions" ? "subscriptions" : "all", kind === "coaching" ? scope : "all")
        if (active) setRevenue(result)
      } catch {
        if (active) setRevenue(null)
      } finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [kind, scope])
  const currentRevenue = (kind === "coaching" ? revenue?.scope === "coaching" && revenue.coach === scope : revenue?.scope === scope) ? revenue : revenue === null ? null : undefined
  const amounts = currentRevenue ? Object.entries(currentRevenue.totals).map(([currency, amount]) => {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency })
    const digits = ["isk", "ugx"].includes(currency.toLowerCase()) ? 2 : formatter.resolvedOptions().maximumFractionDigits ?? 2
    return formatter.format(amount / 10 ** digits)
  }).join(" · ") || "No payments" : currentRevenue === undefined ? "…" : "Unavailable"
  const details = currentRevenue
    ? `Stripe live · ${currentRevenue.month} (UTC). ${kind === "coaching" ? `Coaching payments (${scope === "all" ? "all coaches" : scope}), by recorded booking coach` : scope === "subscriptions" ? "Platform subscription payments" : "All payments"} minus refunds, before fees; excludes payouts. Updated ${new Date(currentRevenue.updatedAt).toLocaleString()}. Refreshes every minute.`
    : currentRevenue === undefined ? "Checking live Stripe data." : "Live Stripe revenue could not be verified. No estimate is shown."
  return (
    <div className="flex shrink-0 items-baseline gap-2 text-sm">
      <Select value={scope} onValueChange={(value) => { setRevenue(undefined); setScope(value as typeof scope) }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger
              aria-label={`${amounts}. Filter ${kind}: ${scope}`}
              className="text-foreground h-auto w-auto gap-1.5 rounded-sm border-0 bg-transparent px-2 py-1 font-medium tabular-nums shadow-none focus-visible:ring-1 [&_svg]:size-3"
            >
              {kind === "coaching" ? (
                <CoachingAvatarGroup
                  avatars={COACHING_COACHES.filter((coach) => scope === "all" || coach.id === scope)}
                  size="xs"
                  label="Selected coaches"
                  className="shrink-0"
                />
              ) : null}
              <span className="inline-flex items-baseline gap-1">
                <span aria-live="polite">{amounts}</span>
                <span className="text-muted-foreground font-normal">/month</span>
              </span>
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">{details}</TooltipContent>
        </Tooltip>
        <SelectContent align="end" className="min-w-52 p-1 [&_[data-slot=select-item]]:pl-3 [&_[data-slot=select-item]]:pr-9">
          {kind === "coaching" ? <>
            <SelectItem value="all">All coaches</SelectItem>
            <SelectItem value="joel">Joel</SelectItem>
            <SelectItem value="paula">Paula</SelectItem>
          </> : <>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="subscriptions">Platform subscriptions</SelectItem>
          </>}
        </SelectContent>
      </Select>
    </div>
  )
}
