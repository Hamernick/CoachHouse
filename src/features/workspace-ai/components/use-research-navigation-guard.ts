import { useEffect, useEffectEvent, useRef } from "react"

/** Protect ordinary link navigation without replacing the application's router.
 * History/router commands and durable draft recovery remain separate contracts. */
export function useResearchNavigationGuard(dirty: boolean, onLeave: (href: string, trigger: HTMLAnchorElement) => void) {
  const approved = useRef(false)
  const requestLeave = useEffectEvent(onLeave)
  useEffect(() => {
    approved.current = false
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      if (approved.current) return
      event.preventDefault(); event.returnValue = ""
    }
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor || anchor.hasAttribute("download")) return
      const target = anchor.getAttribute("target") ?? document.querySelector("base[target]")?.getAttribute("target")
      if (target && target.toLowerCase() !== "_self") return
      let url: URL
      try { url = new URL(anchor.href, window.location.href) } catch { return }
      if (!["http:", "https:"].includes(url.protocol)) return
      // In-page anchors do not discard the current preview.
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) return
      event.preventDefault(); event.stopPropagation()
      requestLeave(url.href, anchor)
    }
    window.addEventListener("beforeunload", warn)
    document.addEventListener("click", intercept, true)
    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", intercept, true)
    }
  }, [dirty])
  return (href: string) => {
    // A confirmed departure uses the exact captured destination. Keep the saved
    // run pointer; never persist private draft content or trigger generation.
    approved.current = true
    window.location.assign(href)
  }
}
