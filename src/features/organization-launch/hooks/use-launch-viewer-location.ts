"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LaunchGlobeLocation } from "../lib/globe-location"
import { requestLaunchViewerLocation } from "../lib/viewer-location"

export function useLaunchViewerLocation() {
  const [location, setLocation] = useState<LaunchGlobeLocation | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const locate = useCallback(async () => {
    const id = ++requestId.current
    setPending(true)
    setError(null)
    try {
      const next = await requestLaunchViewerLocation(navigator.geolocation)
      if (requestId.current === id) setLocation(next)
    } catch (cause) {
      if (requestId.current === id) setError(cause instanceof Error ? cause.message : "Your location couldn’t be found. Try again.")
    } finally {
      if (requestId.current === id) setPending(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const initialRequestId = requestId.current
    // Check existing consent without triggering a browser permission prompt.
    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (active && requestId.current === initialRequestId && permission.state === "granted") void locate()
      }).catch(() => { /* The explicit button also works without Permissions API support. */ })
    }
    return () => { active = false; requestId.current += 1 }
  }, [locate])

  return { location, pending, error, locate }
}
