"use client"

import { useLayoutEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { resolveWorkspaceDrawerGuideState } from "./workspace-canvas-overlay-drawer-state"

export function useWorkspaceDrawerGuideState() {
  const params = useSearchParams()
  const search = params.toString()
  return useMemo(() => resolveWorkspaceDrawerGuideState(new URLSearchParams(search)), [search])
}

export function useWorkspaceDrawerGuide({ state, setOpen, setTab, setSnap }: {
  state: ReturnType<typeof resolveWorkspaceDrawerGuideState>
  setOpen: (open: boolean) => void
  setTab: (tab: "people" | "accelerator" | "organization") => void
  setSnap: (snap: number | string) => void
}) {
  useLayoutEffect(() => {
    if (!state) return
    // Set both values before mounting Vaul; tour navigation must not save preferences.
    setOpen(true)
    setTab(state.tab)
    setSnap(state.snapPoint)
  }, [state, setOpen, setTab, setSnap])
}
