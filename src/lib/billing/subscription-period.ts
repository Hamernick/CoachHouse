type SubscriptionPeriods = {
  current_period_end?: number | null
  items?: { data: Array<{ current_period_end?: number | null }> }
}

/** The next item renewal; also accepts webhook payloads from pre-Basil APIs. */
export function getSubscriptionPeriodEndIso(subscription: SubscriptionPeriods): string | null {
  const periods = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
  const timestamp = periods.length > 0 ? Math.min(...periods) : subscription.current_period_end
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return null
  const date = new Date(timestamp * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
