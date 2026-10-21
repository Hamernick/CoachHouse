"use client"

import { getReactGrabInspectionProps } from "@/components/dev/react-grab-surface"

import {
  useSyncExternalStore,
  type ReactNode,
  type SyntheticEvent,
} from "react"

const EVENT = "coachhouse:react-grab-inspection"

export function setReactGrabInspectionActive(active: boolean) {
  document.documentElement.toggleAttribute("data-react-grab-inspecting", active)
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
function snapshot() {
  return document.documentElement.hasAttribute("data-react-grab-inspecting")
}
const serverSnapshot = () => false

// Real preview content stays inert during normal use. Only the inspection tool
// may target its children; inspection must never execute the preview's actions.
export function ReactGrabPreview({ children }: { children?: ReactNode }) {
  const inspecting = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const block = (event: SyntheticEvent) => {
    if (!inspecting) return
    event.preventDefault()
    event.stopPropagation()
  }
  return (
    <div
      {...getReactGrabInspectionProps("preview")}
      inert={!inspecting}
      className={inspecting ? "select-none" : "pointer-events-none select-none"}
      onClickCapture={block}
      onPointerDownCapture={block}
      onKeyDownCapture={block}
      onDragStartCapture={block}
    >
      {children}
    </div>
  )
}
