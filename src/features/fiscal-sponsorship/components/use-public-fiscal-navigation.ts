"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export function usePublicFiscalNavigation(dirty: boolean) {
  const router = useRouter()
  const [destination, setDestination] = useState<string | null>(null)
  const leaving = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) return
      event.preventDefault(); event.returnValue = ""
    }
    const click = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return
      const url = new URL(anchor.href, window.location.href)
      if (!["http:", "https:"].includes(url.protocol)) return
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return
      event.preventDefault(); event.stopPropagation()
      setDestination(url.href)
    }
    window.addEventListener("beforeunload", warn)
    document.addEventListener("click", click, true)
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", click, true) }
  }, [dirty])
  const leave = () => {
    if (!destination) return
    leaving.current = true
    const url = new URL(destination)
    setDestination(null)
    if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`)
    else window.location.assign(url.href)
  }
  return { destination, cancel: () => setDestination(null), leave }
}
