/** Never send private email-verification URLs to analytics providers. */
export function filterPrivateTelemetry<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url)
    if (["/documentation/fiscal-sponsorship/verify", "/documentation/fiscal-sponsorship/profile", "/documentation/fiscal-sponsorship/application", "/documentation/fiscal-sponsorship/recover"].includes(url.pathname.replace(/\/$/, ""))) return null
    return event
  } catch {
    return null
  }
}
