import { WORKSPACE_SURFACE_MOTION } from "@/lib/workspace-canvas/surface-motion"
import type { useAnimationControls } from "motion/react"

type MotionControls = Pick<
  ReturnType<typeof useAnimationControls>,
  "start" | "stop" | "set"
>
type Rect = { left: number; top: number; width: number; height: number }
// Coach House tuning, not Apple system constants. Keep physical movement and
// visibility independent; see docs/design/workspace-motion-contract.md.
export const WORKSPACE_WINDOW_MOTION = {
  ...WORKSPACE_SURFACE_MOTION,
  closedScale: 0.985,
  travel: 12,
} as const

export function workspaceWindowTransition(collapsed: boolean) {
  return {
    default: WORKSPACE_WINDOW_MOTION.spring,
    opacity: collapsed
      ? WORKSPACE_WINDOW_MOTION.exitOpacity
      : WORKSPACE_WINDOW_MOTION.enterOpacity,
  }
}
export const WORKSPACE_WINDOW_OPEN = { opacity: 1, x: 0, y: 0, scale: 1 }

// Open toward the window from its trigger, including the bottom navigation.
export function resolveWorkspaceWindowOrigin(
  window: Rect,
  anchor: Rect | null
) {
  if (!anchor || window.width <= 0)
    return { originX: 0.5, originY: 1, x: 0, y: WORKSPACE_WINDOW_MOTION.travel }
  const anchorX = anchor.left + anchor.width / 2
  const fromBottom = anchor.top + anchor.height / 2 >= window.top + window.height / 2
  return {
    originX: Math.max(
      0.08,
      Math.min(0.92, (anchorX - window.left) / window.width)
    ),
    originY: fromBottom ? 1 : 0,
    x: 0,
    y: fromBottom ? WORKSPACE_WINDOW_MOTION.travel : -WORKSPACE_WINDOW_MOTION.travel,
  }
}

// New input replaces the current animation; an obsolete completion cannot hide
// a reopened window. No timer, duplicate subtree, or animation queue.
export function createWorkspaceWindowMotionDriver(controls: MotionControls) {
  let revision = 0
  return {
    set: (target: Parameters<MotionControls["set"]>[0]) => {
      revision++
      controls.stop()
      controls.set(target)
    },
    animate: (
      target: Parameters<MotionControls["start"]>[0],
      complete: () => void
    ) => {
      const current = ++revision
      // Retarget in place. A hard stop/reset belongs only to teardown or an
      // accessibility/mode change; Motion owns the current value and velocity.
      void controls.start(target).then(() => {
        if (current === revision) complete()
      })
    },
    stop: () => {
      revision++
      controls.stop()
    },
  }
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
export function readWorkspaceReducedMotion() {
  return typeof window === "undefined" || !window.matchMedia
    ? true
    : window.matchMedia(REDUCED_MOTION_QUERY).matches
}
export function subscribeWorkspaceReducedMotion(onChange: () => void) {
  const media = window.matchMedia?.(REDUCED_MOTION_QUERY)
  media?.addEventListener("change", onChange)
  return () => media?.removeEventListener("change", onChange)
}
export function workspaceReducedMotionServerSnapshot() {
  return true
}
