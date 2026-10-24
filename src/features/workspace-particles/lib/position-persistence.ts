import type { Particle, ParticleOperation, ParticlePosition } from "../types"

type Move = Extract<ParticleOperation, { kind: "move_particles" }>

/** Serialize saves, retaining newer gestures while the preceding move is in flight. */
export function createParticlePositionPersistence({
  commit,
  settled,
  getRevision,
  delay = 250,
}: {
  commit: (operation: Move) => Promise<boolean>
  settled: () => void
  getRevision?: (id: string) => number | undefined
  delay?: number
}) {
  const queued = new Map<string, Move["positions"][number]>()
  const active = new Set<string>()
  let sent = new Map<string, Move["positions"][number]>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let saving: Promise<boolean> | undefined
  let generation = 0
  let requested = false
  const stopTimer = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const flush = (): Promise<boolean> => {
    stopTimer()
    requested = true
    if (saving) return saving
    if (active.size) return Promise.resolve(false)
    if (!queued.size) {
      requested = false
      return Promise.resolve(true)
    }
    const token = generation
    const positions = [...queued.values()]
    sent = new Map(queued)
    queued.clear()
    requested = false
    saving = Promise.resolve().then(async () => {
      let success = false
      try {
        success =
          token === generation &&
          (await commit({ kind: "move_particles", mode: "manual", positions }))
      } catch {
        success = false
      }
      if (token !== generation) return false
      if (success) {
        // Advance only revisions written by our confirmed save, not unrelated edits.
        for (const [id, next] of queued) {
          const previous = sent.get(id)
          const revision = getRevision?.(id)
          if (
            previous &&
            revision !== undefined &&
            next.expectedRevision === previous.expectedRevision
          )
            queued.set(id, { ...next, expectedRevision: revision })
        }
      } else queued.clear()
      sent.clear()
      saving = undefined
      settled()
      if (success && requested && !active.size) return flush()
      return success
    })
    return saving
  }
  return {
    has: (id: string) => queued.has(id) || sent.has(id) || active.has(id),
    isSaving: () => Boolean(saving),
    gesture(id: string, dragging: boolean) {
      if (dragging) {
        active.add(id)
        stopTimer()
      } else active.delete(id)
    },
    record(particle: Particle, position: ParticlePosition) {
      if (
        particle.locked ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      )
        return
      stopTimer()
      const previous = queued.get(particle.id) ?? sent.get(particle.id)
      if (
        !previous &&
        position.x === particle.position.x &&
        position.y === particle.position.y
      )
        return
      queued.set(particle.id, {
        id: particle.id,
        expectedRevision: previous?.expectedRevision ?? particle.revision,
        position: { ...position },
      })
    },
    schedule() {
      stopTimer()
      requested = true
      if (queued.size && !saving && !active.size)
        timer = setTimeout(() => void flush(), delay)
    },
    flush,
    cancel() {
      generation += 1
      stopTimer()
      queued.clear()
      sent = new Map()
      active.clear()
      saving = undefined
      requested = false
    },
  }
}
