"use client"

import { useEffect } from "react"

/** The guide lives in a body portal, outside the inert canvas it demonstrates. */
export function useSetupGuidePreview(open: boolean) {
  useEffect(() => {
    if (!open) return
    const canvas = document.querySelector<HTMLElement>('[data-workspace-guide-canvas="true"]')
    if (!canvas) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const wasInert = canvas.inert
    canvas.inert = true
    return () => {
      canvas.inert = wasInert
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) previousFocus.focus({ preventScroll: true })
    }
  }, [open])
}
