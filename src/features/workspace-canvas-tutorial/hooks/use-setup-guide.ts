"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { normalizeSetupGuideProgress, resolveSetupGuideResumeStage, setupGuideReturnHref, type SetupGuideProgress, type SetupGuideStage } from "../lib/setup-guide"

export function useSetupGuide({ scope, initialActive, restartKey, onClose }: {
  scope: string
  initialActive: boolean
  restartKey: number
  onClose: () => void
}) {
  const router = useRouter()
  const params = useSearchParams()
  const storageKey = `workspace-setup-guide:v2:${scope}`
  const [progress, setProgress] = useState<SetupGuideProgress>({ version: 2, stage: "welcome", status: "paused" })
  const [ready, setReady] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const restartRef = useRef(restartKey)
  const explicitOpen = params.get("guide") === "1"
  const stageParam = params.get("guideStep")
  const inEditor = params.get("view") === "editor" || params.get("drawer") === "roadmap" || (!explicitOpen && Boolean(params.get("drawer")))
  useEffect(() => {
    let stored: SetupGuideProgress | null = null
    try { stored = normalizeSetupGuideProgress(JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem(`workspace-setup-guide:v1:${scope}`) ?? "null")) } catch {}
    setProgress(stored ?? { version: 2, stage: "welcome", status: initialActive ? "active" : "paused" })
    setReady(true)
  }, [storageKey, initialActive, scope])
  const update = useCallback((next: SetupGuideProgress) => {
    setProgress(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageAvailable(true) } catch { setStorageAvailable(false) }
  }, [storageKey])
  useEffect(() => {
    if (!ready || !explicitOpen) return
    let saved: unknown = null
    try { saved = JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem(`workspace-setup-guide:v1:${scope}`) ?? "null") } catch {}
    const stage = resolveSetupGuideResumeStage(stageParam, saved)
    update({ version: 2, stage, status: "active" })
    // Resume the matching surface, not just its instructional card. Replace so
    // Back does not land on the incomplete resume URL again.
    if (!inEditor && stageParam !== stage) {
      window.history.replaceState(null, "", setupGuideReturnHref(stage))
    }
  }, [explicitOpen, ready, stageParam, storageKey, update, scope, inEditor])
  useEffect(() => {
    if (ready && !explicitOpen && !inEditor && progress.status === "active") {
      window.history.replaceState(null, "", setupGuideReturnHref(progress.stage))
    }
  }, [ready, explicitOpen, inEditor, progress.status, progress.stage])
  useEffect(() => {
    if (restartRef.current === restartKey) return
    restartRef.current = restartKey
    update({ version: 2, stage: "welcome", status: "active" })
    window.history.pushState(null, "", setupGuideReturnHref("welcome"))
  }, [restartKey, router, update])
  const navigate = (stage: SetupGuideStage) => {
    update({ version: 2, stage, status: "active" })
    window.history.pushState(null, "", setupGuideReturnHref(stage))
  }
  const close = (finished = false, destination?: string) => {
    update({ ...progress, status: finished ? "finished" : "paused" })
    const remaining = new URLSearchParams(params.toString())
    remaining.delete("guide"); remaining.delete("guideStep")
    // Finishing stays on the mounted canvas. Clear the guide URL synchronously
    // before callbacks can rerender, without waiting for a route transition.
    if (destination && destination !== "/workspace") router.replace(destination, { scroll: false })
    else window.history.replaceState(null, "", finished || destination === "/workspace" ? "/workspace" : `/workspace${remaining.size ? `?${remaining}` : ""}`)
    onClose()
  }
  return { progress, storageAvailable, open: ready && progress.status === "active" && !inEditor, navigate, close }
}
