"use client"
import { useSyncExternalStore } from "react"

let now: number | null = null
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
const refresh = () => { now = Date.now(); listeners.forEach(listener => listener()) }
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    refresh()
    timer = setInterval(refresh, 60_000)
    document.addEventListener("visibilitychange", refresh)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); now = null }
  }
}
const inactive = () => () => {}
const snapshot = () => now
const serverSnapshot = () => null
/** One shared presentation clock; no writes, task completion or execution scheduler. */
export function useParticleProgressClock(enabled: boolean) {
  return useSyncExternalStore(enabled ? subscribe : inactive, snapshot, serverSnapshot) ?? Number.NaN
}
