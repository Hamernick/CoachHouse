"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Locked overviews never prefetch paid lesson routes. */
export function useWorkspaceAcceleratorPrefetch(overviewHref: string, stepHref: string | undefined, enabled: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (enabled && overviewHref.startsWith("/")) router.prefetch(overviewHref)
  }, [enabled, overviewHref, router])
  useEffect(() => {
    if (enabled && stepHref?.startsWith("/")) router.prefetch(stepHref)
  }, [enabled, stepHref, router])
}
