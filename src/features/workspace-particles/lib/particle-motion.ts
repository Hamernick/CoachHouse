import type { DropAnimationFunctionArguments } from "@dnd-kit/core"

export function particleMotionDuration(duration: number) {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : duration
}

export async function animateParticleDrop(
  { dragOverlay, active, transform }: DropAnimationFunctionArguments,
  accepted: boolean
) {
  const duration = particleMotionDuration(accepted ? 140 : 180)
  if (!duration || !dragOverlay.node.animate) return
  const from = `translate3d(${transform.x}px, ${transform.y}px, 0)`
  const to = accepted
    ? from
    : `translate3d(${transform.x + active.rect.left - dragOverlay.rect.left}px, ${transform.y + active.rect.top - dragOverlay.rect.top}px, 0)`
  const animation = dragOverlay.node.animate(
    [
      { transform: from, opacity: 1 },
      { transform: to, opacity: 0 },
    ],
    { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  )
  try {
    await animation.finished
  } catch {
    // A new gesture can interrupt the previous release.
  } finally {
    animation.cancel()
  }
}
