import { useWorkspaceDataScope } from "@/features/organization-workspace-support/client"
import { useCallback, useEffect, useRef, useState } from "react"

import { assignmentValuesEqual, type AssignmentValues } from "../../utils"
import {
  buildAssignmentDraft,
  getAssignmentDraftStorageKey,
  normalizeValuesToInitialSchema,
  readAssignmentDraft,
  serializeAssignmentValues,
} from "../assignment-draft"

type UseAssignmentFormValuesParams = {
  initialValues: AssignmentValues
  moduleId: string
  onSubmit: (
    values: AssignmentValues,
    options?: { silent?: boolean }
  ) => void | Promise<unknown>
}

type UseAssignmentFormValuesResult = {
  values: AssignmentValues
  autoSaving: boolean
  updateValue: (name: string, value: AssignmentValues[string]) => void
}

export function useAssignmentFormValues({
  initialValues,
  moduleId,
  onSubmit,
}: UseAssignmentFormValuesParams): UseAssignmentFormValuesResult {
  const { storageKey: learningScope } = useWorkspaceDataScope()
  const [values, setValues] = useState<AssignmentValues>(initialValues)
  const [autoSaving, setAutoSaving] = useState(false)
  const initialValuesRef = useRef(initialValues)
  const moduleIdRef = useRef(moduleId)
  const valuesRef = useRef(values)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmittedSignatureRef = useRef<string | null>(null)
  const inFlightSubmitSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  useEffect(() => {
    const moduleChanged = moduleIdRef.current !== moduleId
    if (moduleChanged) {
      moduleIdRef.current = moduleId
      initialValuesRef.current = initialValues
      lastSubmittedSignatureRef.current =
        serializeAssignmentValues(initialValues)
      inFlightSubmitSignatureRef.current = null
      setValues(initialValues)
      return
    }

    if (assignmentValuesEqual(initialValuesRef.current, initialValues)) {
      return
    }

    const canReplace = assignmentValuesEqual(
      valuesRef.current,
      initialValuesRef.current
    )
    initialValuesRef.current = initialValues
    lastSubmittedSignatureRef.current = serializeAssignmentValues(initialValues)
    if (canReplace) {
      setValues(initialValues)
    }
  }, [initialValues, moduleId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storageKey = getAssignmentDraftStorageKey(moduleId, learningScope)

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return

      const nextValues = readAssignmentDraft({
        raw,
        initialValues: initialValuesRef.current,
      })
      if (!nextValues) return
      setValues((prev) =>
        assignmentValuesEqual(nextValues, prev) ? prev : nextValues
      )
    } catch {
      // ignore storage errors
    }
  }, [moduleId, learningScope])

  const updateValue = useCallback(
    (name: string, value: AssignmentValues[string]) => {
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    []
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const storageKey = getAssignmentDraftStorageKey(moduleId, learningScope)
    const normalizedValues = normalizeValuesToInitialSchema({
      values,
      initialValues,
    })

    if (!assignmentValuesEqual(normalizedValues, values)) {
      setValues(normalizedValues)
      return
    }

    if (assignmentValuesEqual(normalizedValues, initialValues)) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      try {
        window.localStorage.removeItem(storageKey)
      } catch {
        // ignore storage errors
      }
      const initialSignature = serializeAssignmentValues(initialValues)
      lastSubmittedSignatureRef.current = initialSignature
      if (inFlightSubmitSignatureRef.current === initialSignature) {
        inFlightSubmitSignatureRef.current = null
      }
      setAutoSaving(false)
      return
    }

    try {
      window.localStorage.setItem(
        storageKey,
        buildAssignmentDraft({ initialValues, values: normalizedValues })
      )
    } catch {
      // ignore storage errors
    }

    const nextSignature = serializeAssignmentValues(normalizedValues)
    if (
      nextSignature === lastSubmittedSignatureRef.current ||
      nextSignature === inFlightSubmitSignatureRef.current
    ) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      setAutoSaving(false)
      return
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      inFlightSubmitSignatureRef.current = nextSignature
      setAutoSaving(true)
      Promise.resolve(onSubmit(normalizedValues, { silent: true }))
        .then((saved) => {
          if (saved !== false) {
            lastSubmittedSignatureRef.current = nextSignature
          }
        })
        .catch((error) => {
          console.error("Autosave failed", error)
        })
        .finally(() => {
          if (inFlightSubmitSignatureRef.current === nextSignature) {
            inFlightSubmitSignatureRef.current = null
          }
          setAutoSaving(false)
        })
    }, 2000)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [moduleId, learningScope, onSubmit, values, initialValues])

  return {
    values,
    autoSaving,
    updateValue,
  }
}
