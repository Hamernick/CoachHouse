export type ParticleDragPoint = { x: number; y: number }
export const PARTICLE_DRAG_MOTION = {
  threshold: 6,
  lift: 0.12,
  settle: 0.09,
  cancel: 0.14,
  tilt: -1.5,
  ease: [0.22, 1, 0.36, 1] as const,
}

/** One gesture owns one placement. A click or cancelled gesture never writes. */
export function createParticleDragGesture({
  origin,
  begin,
  move,
  drop,
  cancel,
}: {
  origin: ParticleDragPoint
  begin: () => boolean
  move: (point: ParticleDragPoint) => void
  drop: (point: ParticleDragPoint) => void
  cancel: () => void
}) {
  let active = false
  let ended = false
  return {
    move(point: ParticleDragPoint) {
      if (ended) return
      if (!active) {
        if (
          Math.hypot(point.x - origin.x, point.y - origin.y) <
          PARTICLE_DRAG_MOTION.threshold
        )
          return
        active = begin()
        if (!active) {
          ended = true
          return
        }
      }
      move(point)
    },
    end(point: ParticleDragPoint) {
      if (ended) return
      ended = true
      if (active) drop(point)
    },
    cancel() {
      if (ended) return
      ended = true
      if (active) cancel()
    },
    get active() {
      return active && !ended
    },
  }
}

export function particleDragAnchor(
  point: ParticleDragPoint,
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
) {
  return {
    x: Math.max(0, Math.min(rect.width, point.x - rect.left)),
    y: Math.max(0, Math.min(rect.height, point.y - rect.top)),
  }
}
export function particleDragOrigin(
  point: ParticleDragPoint,
  anchor: ParticleDragPoint
) {
  return { x: point.x - anchor.x, y: point.y - anchor.y }
}
