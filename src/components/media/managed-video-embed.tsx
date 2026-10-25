"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useMediaActivity } from "./media-activity"
import { getEmbedProvider, prepareEmbedUrl } from "./embed-provider"
import { loadYouTubeApi, loadVimeoApi } from "./embed-sdk"
import { createEmbeddedPlaybackSession } from "./embed-playback"

export function ManagedVideoEmbed({
  src,
  title,
}: {
  src: string
  title: string
}) {
  const active = useMediaActivity()
  const host = useRef<HTMLDivElement>(null)
  const playback = useRef<ReturnType<
    typeof createEmbeddedPlaybackSession
  > | null>(null)
  const activeRef = useRef(active)
  const [fallbackPlaybackSource, setFallbackPlaybackSource] = useState<
    string | null
  >(null)
  const [readySource, setReadySource] = useState<string | null>(null)
  const [fallbackSource, setFallbackSource] = useState<string | null>(null)
  const provider = getEmbedProvider(src)
  const fallback = provider === "external" || fallbackSource === src

  useLayoutEffect(() => {
    activeRef.current = active
    if (!active) setFallbackPlaybackSource(null)
    playback.current?.setActive(active)
  }, [active])

  useEffect(() => {
    const container = host.current
    if (fallback || !container) return
    setReadySource(null)
    let cancelled = false
    let disposePlayer = () => {}
    let playerDisposed = false
    const dispose = () => {
      if (playerDisposed) return
      playerDisposed = true
      try {
        disposePlayer()
      } catch {
        /* Removing the frame still stops playback if SDK teardown fails. */
      }
      frame.remove()
    }
    let readyTimeout = 0
    const fail = () => {
      if (!cancelled) setFallbackSource(src)
    }
    const session = createEmbeddedPlaybackSession(fail)
    playback.current = session
    session.setActive(activeRef.current)
    const frame = document.createElement("iframe")
    frame.title = title
    frame.className = "absolute inset-0 h-full w-full"
    frame.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    frame.allowFullscreen = true
    frame.src = prepareEmbedUrl(src, window.location.origin)
    const mount = () => {
      if (cancelled) return false
      container.append(frame)
      readyTimeout = window.setTimeout(fail, 12000)
      return true
    }
    const ready = (pause: () => void | Promise<void>) => {
      if (cancelled) return
      window.clearTimeout(readyTimeout)
      setReadySource(src)
      session.ready({ pause, dispose })
    }
    if (provider === "youtube") {
      void loadYouTubeApi()
        .then((api) => {
          if (!mount()) return
          const player = new api.Player(frame, {
            events: {
              onReady: (event) => ready(() => event.target.pauseVideo()),
              onStateChange: (event) => {
                if (event.data === 1) session.playing()
              },
            },
          })
          disposePlayer = () => player.destroy()
        })
        .catch(fail)
    } else {
      void loadVimeoApi()
        .then((api) => {
          if (!mount()) return
          const player = new api.Player(frame)
          player.on("play", session.playing)
          disposePlayer = () => {
            player.off("play", session.playing)
            void player.destroy().catch(() => {})
          }
          return player.ready().then(() => ready(() => player.pause()))
        })
        .catch(fail)
    }
    return () => {
      cancelled = true
      window.clearTimeout(readyTimeout)
      // The SDK owns the iframe inside this host, avoiding React/SDK competing
      // over one element during Strict Mode setup/cleanup or lesson changes.
      session.dispose()
      dispose()
      frame.remove()
      if (playback.current === session) playback.current = null
    }
  }, [fallback, provider, src, title])

  return (
    <div className="absolute inset-0">
      {!fallback && readySource !== src ? (
        <p
          role="status"
          className="text-muted-foreground bg-muted absolute inset-0 grid place-items-center text-sm"
        >
          Loading video…
        </p>
      ) : null}
      <div ref={host} className="absolute inset-0" />
      {fallback && active && fallbackPlaybackSource === src ? (
        <iframe
          src={
            active
              ? prepareEmbedUrl(
                  src,
                  typeof window === "undefined" ? "" : window.location.origin
                )
              : "about:blank"
          }
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : fallback ? (
        <div className="bg-muted absolute inset-0 grid place-items-center">
          <Button
            variant="secondary"
            disabled={!active}
            onClick={() => setFallbackPlaybackSource(src)}
          >
            Load video
          </Button>
        </div>
      ) : null}
    </div>
  )
}
