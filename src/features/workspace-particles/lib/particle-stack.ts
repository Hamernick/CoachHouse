import { PARTICLE_DRAG_MOTION } from "./particle-drag-gesture"

export type ParticlePlacementPhase = "placed" | "confirmed" | "failed"
export const PARTICLE_STACK_MOTION = {
  gap: 6,
  scaleStep: 0.04,
  duration: 0.24,
  ease: PARTICLE_DRAG_MOTION.ease,
} as const

// Optimistic handoff and confirmation belong to the same placement, even when
// confirmation arrives first. A failed save cancels any local promotion.
export function createParticleStackPlacement(
  advance: () => void,
  reset: () => void
) {
  let advanced = false
  let failed = false
  return (phase: ParticlePlacementPhase) => {
    if (failed) return
    if (phase === "failed") {
      failed = true
      if (advanced) reset()
    } else if (!advanced) {
      advanced = true
      advance()
    }
  }
}

export function readParticleStackReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true
}
export function subscribeParticleStackReducedMotion(notify: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {}
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}
