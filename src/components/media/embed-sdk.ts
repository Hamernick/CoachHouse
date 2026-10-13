// Official provider SDKs; loaded only for a managed lesson embed.
// https://developers.google.com/youtube/iframe_api_reference
// https://github.com/vimeo/player.js
interface YouTubePlayer {
  pauseVideo(): void
  destroy(): void
}
interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: (event: { target: YouTubePlayer }) => void
        onStateChange: (event: { target: YouTubePlayer; data: number }) => void
      }
    }
  ) => YouTubePlayer
}
interface VimeoPlayer {
  ready(): Promise<void>
  pause(): Promise<void>
  on(event: "play", callback: () => void): void
  off(event: "play", callback: () => void): void
  destroy(): Promise<void>
}
interface VimeoApi {
  Player: new (element: HTMLIFrameElement) => VimeoPlayer
}

declare global {
  interface Window {
    YT?: YouTubeApi
    Vimeo?: VimeoApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtube: Promise<YouTubeApi> | undefined
let vimeo: Promise<VimeoApi> | undefined

function loadScript(src: string, ready: () => void, fail: () => void) {
  const script = document.createElement("script")
  script.src = src
  script.async = true
  script.addEventListener("load", ready, { once: true })
  script.addEventListener("error", fail, { once: true })
  document.head.append(script)
  return script
}

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtube) return youtube
  youtube = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const finish = () => {
      if (!window.YT?.Player) return
      cleanup()
      resolve(window.YT)
    }
    const callback = () => {
      try {
        previous?.()
      } finally {
        finish()
      }
    }
    const cleanup = () => {
      window.clearTimeout(timeout)
      if (window.onYouTubeIframeAPIReady === callback)
        window.onYouTubeIframeAPIReady = previous
    }
    const fail = () => {
      cleanup()
      script.remove()
      youtube = undefined
      reject(new Error("YouTube controls unavailable"))
    }
    window.onYouTubeIframeAPIReady = callback
    const timeout = window.setTimeout(fail, 12000)
    const script = loadScript(
      "https://www.youtube.com/iframe_api",
      finish,
      fail
    )
  })
  return youtube
}

export function loadVimeoApi(): Promise<VimeoApi> {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo)
  if (vimeo) return vimeo
  vimeo = new Promise<VimeoApi>((resolve, reject) => {
    const fail = () => {
      window.clearTimeout(timeout)
      script.remove()
      vimeo = undefined
      reject(new Error("Vimeo controls unavailable"))
    }
    const timeout = window.setTimeout(fail, 12000)
    const script = loadScript(
      "https://player.vimeo.com/api/player.js",
      () => {
        if (!window.Vimeo?.Player) return fail()
        window.clearTimeout(timeout)
        resolve(window.Vimeo)
      },
      fail
    )
  })
  return vimeo
}
