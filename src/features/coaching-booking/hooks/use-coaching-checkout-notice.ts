import { useEffect } from "react"

export function useCoachingCheckoutNotice(notice: string | undefined, noticeDismissed: boolean) {
  useEffect(() => {
    if (!notice) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("checkout") !== "unavailable") return
    url.searchParams.delete("checkout")
    // Keep the displayed notice for this visit, while refreshes use the clean URL.
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }, [notice])

  return noticeDismissed ? undefined : notice
}
