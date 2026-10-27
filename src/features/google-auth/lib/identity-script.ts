const SCRIPT_ID = "google-identity-services"
export const GOOGLE_IDENTITY_SCRIPT_URL =
  "https://accounts.google.com/gsi/client"
let loading: Promise<void> | null = null

/** Share one SDK load. A failed load is removed so an explicit retry can load it again. */
export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  if (loading) return loading

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_URL
    script.async = true
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
      if (ok) {
        resolve()
      } else {
        script.remove()
        loading = null
        reject(new Error("Google sign-in script unavailable"))
      }
    }
    const timer = window.setTimeout(() => finish(false), 15_000)
    script.onload = () => finish(Boolean(window.google?.accounts.id))
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })
  return loading
}
