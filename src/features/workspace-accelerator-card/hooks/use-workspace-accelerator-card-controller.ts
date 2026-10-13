"use client"

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  normalizeWorkspaceAcceleratorCardInput,
  resolveWorkspaceAcceleratorCardTargetSize,
} from "../lib"
import type { WorkspaceAcceleratorCardInput } from "../types"

function areOrderedStringListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

export function useWorkspaceAcceleratorCardController(
  input: WorkspaceAcceleratorCardInput
) {
  const normalized = normalizeWorkspaceAcceleratorCardInput(input)
  const {
    steps,
    size,
    allowAutoResize,
    storageKey,
    onSizeChange,
    initialCurrentStepId,
    initialCompletedStepIds,
    onProgressChange,
  } = normalized

  const stepIds = useMemo(() => steps.map((step) => step.id), [steps])
  const stepIdsSignature = useMemo(() => stepIds.join("|"), [stepIds])
  const initialCurrentIndexFromInput = useMemo(() => {
    if (!initialCurrentStepId) return 0
    const nextIndex = stepIds.findIndex(
      (stepId) => stepId === initialCurrentStepId
    )
    if (nextIndex < 0) return 0
    return nextIndex
  }, [initialCurrentStepId, stepIds])
  const initialCompletedStepIdsFromInput = useMemo(() => {
    if (!initialCompletedStepIds || initialCompletedStepIds.length === 0) {
      return [] as string[]
    }
    const validStepIds = new Set(stepIds)
    return initialCompletedStepIds.filter((stepId) => validStepIds.has(stepId))
  }, [initialCompletedStepIds, stepIds])

  const [currentIndex, setCurrentIndex] = useState(initialCurrentIndexFromInput)
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(
    initialCompletedStepIdsFromInput
  )
  const lastAutoResizeTargetRef = useRef<string | null>(null)
  const lastProgressSignatureRef = useRef<string | null>(null)
  const pendingUserProgressChangeRef = useRef(false)
  const hydratedStorageKeyRef = useRef<string | null>(null)
  const lastInitialCurrentStepSyncKeyRef = useRef<string | null>(null)
  const lastInitialCompletedSyncKeyRef = useRef<string | null>(null)
  const stepIdToIndex = useMemo(() => {
    const lookup = new Map<string, number>()
    for (let index = 0; index < stepIds.length; index += 1) {
      const stepId = stepIds[index]
      if (!stepId || lookup.has(stepId)) continue
      lookup.set(stepId, index)
    }
    return lookup
  }, [stepIds])
  const validStepIds = useMemo(() => new Set(stepIds), [stepIds])
  const initialCompletedStepIdsSignature = useMemo(() => {
    if (initialCompletedStepIdsFromInput.length === 0) return ""
    return initialCompletedStepIdsFromInput.join("|")
  }, [initialCompletedStepIdsFromInput])
  const hasInitialCompletedFromInput =
    initialCompletedStepIdsFromInput.length > 0

  useEffect(() => {
    if (!storageKey) {
      hydratedStorageKeyRef.current = null
      return
    }
    if (hydratedStorageKeyRef.current === storageKey) return
    if (initialCurrentStepId || hasInitialCompletedFromInput) {
      hydratedStorageKeyRef.current = storageKey
      return
    }
    hydratedStorageKeyRef.current = storageKey

    const raw = window.localStorage.getItem(
      `workspace-accelerator-card:${storageKey}`
    )
    if (!raw) return
    const nextIndex = Number.parseInt(raw, 10)
    if (!Number.isFinite(nextIndex) || nextIndex < 0) return
    startTransition(() => {
      setCurrentIndex((previous) =>
        previous === nextIndex ? previous : nextIndex
      )
    })

    const rawCompleted = window.localStorage.getItem(
      `workspace-accelerator-card-complete:${storageKey}`
    )
    if (!rawCompleted) return
    try {
      const parsed = JSON.parse(rawCompleted)
      if (!Array.isArray(parsed)) return
      const nextCompleted = parsed.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
      if (nextCompleted.length === 0) return
      startTransition(() => {
        setCompletedStepIds((previous) =>
          areOrderedStringListsEqual(previous, nextCompleted)
            ? previous
            : nextCompleted
        )
      })
    } catch {
      // best-effort hydration only
    }
  }, [hasInitialCompletedFromInput, initialCurrentStepId, storageKey])

  useEffect(() => {
    if (!initialCurrentStepId || stepIds.length === 0) return
    const syncKey = `${initialCurrentStepId}::${stepIdsSignature}`
    if (lastInitialCurrentStepSyncKeyRef.current === syncKey) return
    lastInitialCurrentStepSyncKeyRef.current = syncKey
    const nextIndex = stepIdToIndex.get(initialCurrentStepId)
    if (typeof nextIndex !== "number") return
    setCurrentIndex((previous) =>
      previous === nextIndex ? previous : nextIndex
    )
  }, [initialCurrentStepId, stepIdToIndex, stepIds.length, stepIdsSignature])

  useEffect(() => {
    const syncKey = `${initialCompletedStepIdsSignature}::${stepIdsSignature}`
    if (lastInitialCompletedSyncKeyRef.current === syncKey) return
    lastInitialCompletedSyncKeyRef.current = syncKey

    if (initialCompletedStepIdsFromInput.length === 0) {
      setCompletedStepIds((previous) => (previous.length === 0 ? previous : []))
      return
    }

    const nextCompleted = initialCompletedStepIdsFromInput.filter((stepId) =>
      validStepIds.has(stepId)
    )
    setCompletedStepIds((previous) => {
      if (areOrderedStringListsEqual(previous, nextCompleted)) {
        return previous
      }
      return nextCompleted
    })
  }, [
    initialCompletedStepIdsFromInput,
    initialCompletedStepIdsSignature,
    stepIdsSignature,
    validStepIds,
  ])

  useEffect(() => {
    if (stepIds.length === 0) {
      setCurrentIndex((previous) => (previous === 0 ? previous : 0))
      setCompletedStepIds((previous) => (previous.length === 0 ? previous : []))
      return
    }
    setCurrentIndex((previous) => Math.min(previous, stepIds.length - 1))
    setCompletedStepIds((previous) => {
      if (previous.length === 0) return previous
      const next = previous.filter((stepId) => validStepIds.has(stepId))
      return areOrderedStringListsEqual(previous, next) ? previous : next
    })
  }, [stepIds.length, stepIdsSignature, validStepIds])

  const currentStep = steps[currentIndex] ?? null
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < steps.length - 1

  const goPrevious = useCallback(() => {
    if (!canGoPrevious) return
    pendingUserProgressChangeRef.current = true
    startTransition(() =>
      setCurrentIndex((previous) => Math.max(0, previous - 1))
    )
  }, [canGoPrevious])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    pendingUserProgressChangeRef.current = true
    startTransition(() =>
      setCurrentIndex((previous) => Math.min(steps.length - 1, previous + 1))
    )
  }, [canGoNext, steps.length])

  const goToStep = useCallback(
    (stepId: string) => {
      const nextIndex = stepIdToIndex.get(stepId)
      if (typeof nextIndex !== "number" || nextIndex === currentIndex) return
      pendingUserProgressChangeRef.current = true
      // Commit the selection with the caller's viewer-open update. Deferring it
      // mounts the previous lesson (including organization setup) first.
      setCurrentIndex((previous) =>
        previous === nextIndex ? previous : nextIndex
      )
    },
    [currentIndex, stepIdToIndex]
  )

  const markCurrentStepComplete = useCallback((wholeModule = false) => {
    if (!currentStep || (!wholeModule && completedStepIds.includes(currentStep.id))) return
    pendingUserProgressChangeRef.current = true
    setCompletedStepIds((previous) => {
      const ids = wholeModule
        ? steps.filter((step) => step.moduleId === currentStep.moduleId).map((step) => step.id)
        : [currentStep.id]
      return Array.from(new Set([...previous, ...ids]))
    })
  }, [completedStepIds, currentStep, steps])

  useEffect(() => {
    if (!allowAutoResize || !onSizeChange || !currentStep) return
    if (size === "lg") return
    const targetSize = resolveWorkspaceAcceleratorCardTargetSize(currentStep)
    if (lastAutoResizeTargetRef.current === targetSize && targetSize !== size)
      return
    lastAutoResizeTargetRef.current = targetSize
    if (targetSize !== size) {
      onSizeChange(targetSize)
    }
  }, [allowAutoResize, currentStep, onSizeChange, size])

  useEffect(() => {
    if (!storageKey || steps.length === 0) return
    window.localStorage.setItem(
      `workspace-accelerator-card:${storageKey}`,
      String(currentIndex)
    )
  }, [currentIndex, steps.length, storageKey])

  useEffect(() => {
    if (!storageKey) return
    if (completedStepIds.length === 0) {
      window.localStorage.removeItem(
        `workspace-accelerator-card-complete:${storageKey}`
      )
      return
    }
    window.localStorage.setItem(
      `workspace-accelerator-card-complete:${storageKey}`,
      JSON.stringify(completedStepIds)
    )
  }, [completedStepIds, storageKey])

  const currentModuleSteps = useMemo(() => {
    if (!currentStep) return []
    return steps.filter((step) => step.moduleId === currentStep.moduleId)
  }, [currentStep, steps])

  const currentModuleStepIndex = useMemo(() => {
    if (!currentStep) return -1
    return currentModuleSteps.findIndex((step) => step.id === currentStep.id)
  }, [currentModuleSteps, currentStep])

  const isCurrentStepCompleted = Boolean(
    currentStep && completedStepIds.includes(currentStep.id)
  )
  const currentModuleCompletedCount = useMemo(() => {
    if (!currentStep || currentModuleSteps.length === 0) return 0
    return currentModuleSteps.filter((step) =>
      completedStepIds.includes(step.id)
    ).length
  }, [completedStepIds, currentModuleSteps, currentStep])
  const isCurrentModuleCompleted =
    currentModuleSteps.length > 0 &&
    currentModuleCompletedCount >= currentModuleSteps.length

  const progressSignature = useMemo(
    () =>
      JSON.stringify({
        currentStepId: currentStep?.id ?? null,
        completedStepIds,
      }),
    [completedStepIds, currentStep?.id]
  )

  useEffect(() => {
    if (lastProgressSignatureRef.current === progressSignature) return
    lastProgressSignatureRef.current = progressSignature
    if (!pendingUserProgressChangeRef.current) return
    pendingUserProgressChangeRef.current = false
    onProgressChange?.({
      currentStepId: currentStep?.id ?? null,
      completedStepIds,
    })
  }, [completedStepIds, currentStep?.id, onProgressChange, progressSignature])

  return {
    steps,
    currentStep,
    currentIndex,
    currentModuleSteps,
    currentModuleStepIndex,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    goToStep,
    completedStepIds,
    isCurrentStepCompleted,
    currentModuleCompletedCount,
    isCurrentModuleCompleted,
    markCurrentStepComplete,
  }
}
