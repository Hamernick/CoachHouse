export type EmbeddedPlaybackControl = {
  pause: () => void | Promise<void>
  dispose: () => void
}

// Ready may arrive after minimize, source replacement, or unmount. Never play on
// restore, and never let an obsolete player attach to a newer lesson.
export function createEmbeddedPlaybackSession(onFailure: () => void) {
  let active = true
  let disposed = false
  let controller: EmbeddedPlaybackControl | null = null
  const pause = () => {
    if (!controller) return
    try {
      const result = controller.pause()
      void Promise.resolve(result).catch(() => {
        if (!disposed) onFailure()
      })
    } catch {
      if (!disposed) onFailure()
    }
  }
  return {
    setActive(next: boolean) {
      active = next
      if (!active && !disposed) pause()
    },
    ready(next: EmbeddedPlaybackControl) {
      if (disposed) return next.dispose()
      controller = next
      if (!active) pause()
    },
    playing() {
      if (!active && !disposed) pause()
    },
    dispose() {
      if (disposed) return
      disposed = true
      controller?.dispose()
      controller = null
    },
  }
}
