export type EmbedProvider = "youtube" | "vimeo" | "external"

export function getEmbedProvider(src: string): EmbedProvider {
  try {
    const url = new URL(src)
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return "external"
    if (
      [
        "www.youtube.com",
        "youtube.com",
        "www.youtube-nocookie.com",
        "youtube-nocookie.com",
      ].includes(url.hostname) &&
      url.pathname.startsWith("/embed/")
    )
      return "youtube"
    if (
      url.hostname === "player.vimeo.com" &&
      url.pathname.startsWith("/video/")
    )
      return "vimeo"
  } catch {
    /* Invalid embeds do not receive player capabilities. */
  }
  return "external"
}

export function prepareEmbedUrl(src: string, origin: string) {
  const provider = getEmbedProvider(src)
  if (provider === "external") return src
  const url = new URL(src)
  // Restoring a retained panel never starts playback by itself.
  url.searchParams.set("autoplay", "0")
  if (provider === "youtube") {
    url.searchParams.set("enablejsapi", "1")
    url.searchParams.set("origin", origin)
  }
  return url.toString()
}
