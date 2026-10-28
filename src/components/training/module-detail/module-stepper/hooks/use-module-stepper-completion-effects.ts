"use client"

import { useWorkspaceDataScope } from "@/features/organization-workspace-support/client"
import { useEffect, useRef } from "react"

import type { ModuleStepperStep } from "../../module-stepper-types"

type UseModuleStepperCompletionEffectsArgs = {
  moduleId: string
  activeStep: ModuleStepperStep | undefined
  markModuleComplete: () => Promise<unknown>
}

export function useModuleStepperCompletionEffects({
  moduleId,
  activeStep,
  markModuleComplete,
}: UseModuleStepperCompletionEffectsArgs) {
  const { storageKey: learningScope } = useWorkspaceDataScope()
  const completionMarkedRef = useRef(false)
  const celebratePlayedRef = useRef(false)

  useEffect(() => {
    completionMarkedRef.current = false
    celebratePlayedRef.current = false
  }, [moduleId])

  useEffect(() => {
    if (activeStep?.type !== "complete" || completionMarkedRef.current) return

    completionMarkedRef.current = true
    void markModuleComplete().catch(() => null)

    try {
      window.sessionStorage.setItem(`module-complete-${learningScope}-${moduleId}`, "true")
    } catch {
      // ignore storage failures
    }
  }, [activeStep?.id, activeStep?.type, markModuleComplete, moduleId, learningScope])

  useEffect(() => {
    if (activeStep?.type !== "complete" || celebratePlayedRef.current) return

    celebratePlayedRef.current = true
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "triangle"
      oscillator.frequency.value = 880
      gain.gain.value = 0.0001
      oscillator.connect(gain)
      gain.connect(context.destination)
      const now = context.currentTime
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      oscillator.start(now)
      oscillator.stop(now + 0.42)
      oscillator.onended = () => context.close().catch(() => null)
    } catch {
      // Ignore audio errors or autoplay restrictions.
    }
  }, [activeStep?.type])
}
