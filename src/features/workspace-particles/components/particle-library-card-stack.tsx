"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { animate } from "motion/react"
import { PARTICLE_LIBRARY_CARD_SHAPE } from "./particle-library-view"
import {
  createParticleStackPlacement,
  PARTICLE_STACK_MOTION,
  readParticleStackReducedMotion,
  subscribeParticleStackReducedMotion,
  type ParticlePlacementPhase,
} from "../lib/particle-stack"

const reducedServerSnapshot = () => true
export function ParticleLibraryCardStack({
  children,
  enabled,
}: {
  enabled: boolean
  children: (
    getPlacement?: () => (phase: ParticlePlacementPhase) => void
  ) => ReactNode
}) {
  const front = useRef<HTMLDivElement>(null)
  const backs = useRef<Array<HTMLDivElement | null>>([])
  const animations = useRef<Array<{ stop: () => void }>>([])
  const generation = useRef(0)
  const attempt = useRef(0)
  const reduced = useSyncExternalStore(
    subscribeParticleStackReducedMotion,
    readParticleStackReducedMotion,
    reducedServerSnapshot
  )
  const stop = useCallback(() => {
    generation.current++
    for (const animation of animations.current) animation.stop()
    animations.current = []
  }, [])
  const reset = useCallback(() => {
    stop()
    if (front.current) {
      front.current.style.transform = ""
      front.current.style.opacity = ""
    }
    backs.current.forEach((back, index) => {
      if (!back) return
      const depth = index + 1
      back.style.transform = `translateY(${depth * PARTICLE_STACK_MOTION.gap}px) scale(${1 - depth * PARTICLE_STACK_MOTION.scaleStep})`
      back.style.opacity = "1"
    })
  }, [stop])
  const invalidate = useCallback(() => {
    attempt.current++
    stop()
  }, [stop])
  useEffect(() => {
    if (reduced || !enabled) reset()
    return invalidate
  }, [reduced, enabled, reset, invalidate])
  const advance = useCallback(() => {
    reset()
    if (!enabled || readParticleStackReducedMotion()) return
    const layers = [front.current, ...backs.current]
    if (layers.some((layer) => !layer)) return
    const version = generation.current
    try {
      const pending = layers.flatMap((layer, depth) => {
        if (!layer) return []
        // The outgoing card is already in the existing drag overlay. Its next
        // instance rises from the first back-card position without remounting.
        const animation = animate(
          layer,
          {
            y: [
              (depth + 1) * PARTICLE_STACK_MOTION.gap,
              depth * PARTICLE_STACK_MOTION.gap,
            ],
            scale: [
              1 - (depth + 1) * PARTICLE_STACK_MOTION.scaleStep,
              1 - depth * PARTICLE_STACK_MOTION.scaleStep,
            ],
            opacity: depth === 0 || depth === 2 ? [0, 1] : [1, 1],
          },
          {
            duration: PARTICLE_STACK_MOTION.duration,
            ease: PARTICLE_STACK_MOTION.ease,
          }
        )
        animations.current.push(animation)
        return [animation]
      })
      void Promise.all(pending)
        .then(() => {
          if (generation.current === version) reset()
        })
        .catch(() => {
          if (generation.current === version) reset()
        })
    } catch {
      if (generation.current === version) reset()
    }
  }, [enabled, reset])
  const getPlacement = useCallback(() => {
    const currentAttempt = ++attempt.current
    // Finish an interrupted promotion before the drag provider measures the
    // source, so quick consecutive gestures keep the same grab coordinates.
    reset()
    return createParticleStackPlacement(
      () => {
        if (attempt.current === currentAttempt) advance()
      },
      () => {
        // A late failure cannot cancel a newer card's stack animation.
        if (attempt.current === currentAttempt) reset()
      }
    )
  }, [advance, reset])
  if (!enabled) return children()
  return (
    <div className="pb-3" data-particle-library-stack="true">
      <div className={`relative isolate ${PARTICLE_LIBRARY_CARD_SHAPE}`}>
        {[2, 1].map((depth) => (
          <div
            key={depth}
            ref={(element) => {
              backs.current[depth - 1] = element
            }}
            data-particle-stack-back={depth}
            aria-hidden
            inert
            className="border-border/70 bg-card pointer-events-none absolute inset-0 origin-bottom rounded-[inherit] border shadow-none"
            style={{
              zIndex: 3 - depth,
              transform: `translateY(${depth * PARTICLE_STACK_MOTION.gap}px) scale(${1 - depth * PARTICLE_STACK_MOTION.scaleStep})`,
            }}
          />
        ))}
        <div ref={front} className="relative z-[3] origin-bottom">
          {children(getPlacement)}
        </div>
      </div>
    </div>
  )
}
