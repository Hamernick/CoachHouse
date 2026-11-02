"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const browserSnapshot = () => true
const serverSnapshot = () => false

/** Stable UTC HTML before hydration; then the reader's locale and time zone.
 * The stored instant never changes and no organization/source lookup is needed. */
export function PublicEventTime({ value, locale }: { value: string; locale?: string }) {
  const hydrated = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot)
  let timeZone = "UTC"
  let language = locale ?? "en-US"
  if (hydrated) {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    language = locale ?? navigator.language
  }
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone,
  }
  let label: string
  try { label = new Intl.DateTimeFormat(language, options).format(new Date(value)) }
  catch { label = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(value)); timeZone = "UTC" }
  return <time dateTime={value}>{label} <span className="text-muted-foreground">{timeZone}</span></time>
}
