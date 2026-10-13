"use client"

import { useSyncExternalStore } from "react"

// Include hybrid devices: preserve native touch panning when touch is available.
const TOUCH_QUERY = "(any-pointer: coarse)"
const POINTER_PAN_BUTTONS = [1, 2]

function subscribe(listener: () => void) {
  const media = window.matchMedia(TOUCH_QUERY)
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}

export function resolveWorkspaceCanvasSelection(
  touch: boolean,
  tutorial: boolean
) {
  return {
    selectionOnDrag: !touch && !tutorial,
    panOnDrag: touch || tutorial ? true : POINTER_PAN_BUTTONS,
  }
}

export function useWorkspaceCanvasSelection(tutorial: boolean) {
  const touch = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => true
  )
  return resolveWorkspaceCanvasSelection(touch, tutorial)
}
