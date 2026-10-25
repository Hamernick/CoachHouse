"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { hasWorkspaceUnsavedChanges, isCurrentWorkspace } from "../lib/navigation"

export function useWorkspaceNavigation() {
  const router = useRouter()
  const [destination, setDestination] = useState<string | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const commit = useCallback((href: string) => {
    if (isCurrentWorkspace(href, window.location.href)) router.refresh()
    else router.push(href, { scroll: false })
  }, [router])
  const navigate = useCallback((href: string) => {
    if (hasWorkspaceUnsavedChanges(window)) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setDestination(href)
      return
    }
    commit(href)
  }, [commit])

  useEffect(() => {
    // Run before editor-specific document handlers so a single app dialog owns
    // workspace changes. Modified clicks retain normal new-tab behavior.
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-workspace-navigation]") : null
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return
      const url = new URL(link.href)
      if (url.origin !== window.location.origin || url.pathname !== "/workspace") return
      event.preventDefault()
      event.stopPropagation()
      if (!isCurrentWorkspace(url.href, window.location.href)) navigate(`${url.pathname}${url.search}`)
    }
    window.addEventListener("click", click, true)
    return () => window.removeEventListener("click", click, true)
  }, [navigate])

  const cancel = () => setDestination(null)
  const discard = () => {
    if (!destination) return
    commit(destination)
    setDestination(null)
  }
  return { navigate, open: destination !== null, cancel, discard, returnFocus }
}
