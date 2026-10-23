const PRIVATE_WORKFLOW_PATHS = [
  "/documentation/fiscal-sponsorship/verify",
  "/documentation/fiscal-sponsorship/profile",
  "/documentation/fiscal-sponsorship/application",
  "/documentation/fiscal-sponsorship/recover",
  "/fiscal-sponsorship/sign",
  "/fiscal-sponsorship/w9",
]

/** Measure pages without forwarding URL credentials, search text or private workflow IDs. */
export function filterPrivateTelemetry<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null

    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "")
    if (PRIVATE_WORKFLOW_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return null
    }

    if (!url.search && !url.hash) return event
    url.search = ""
    url.hash = ""
    return { ...event, url: url.href }
  } catch {
    return null
  }
}
