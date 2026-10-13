"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { GuestDraftController } from "../lib/guest-draft-controller"

export function usePublicFiscalDraft(enabled: boolean) {
  const [controller] = useState(() => new GuestDraftController(enabled))
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { void controller.start(); return () => controller.stop() }, [controller])
  return { state, controller }
}
