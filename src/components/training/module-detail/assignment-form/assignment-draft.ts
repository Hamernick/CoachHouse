import type { AssignmentValues } from "../utils"

type StoredAssignmentDraft = {
  baseSignature?: string
  updatedAt?: string
  values?: AssignmentValues
}

export function getAssignmentDraftStorageKey(moduleId: string, scope = "unscoped") {
  return `assignment-autosave-v2-${scope}-${moduleId}`
}

export function serializeAssignmentValues(values: AssignmentValues) {
  return JSON.stringify(values)
}

export function normalizeValuesToInitialSchema({
  values,
  initialValues,
}: {
  values: AssignmentValues
  initialValues: AssignmentValues
}): AssignmentValues {
  const normalized: AssignmentValues = {}
  for (const key of Object.keys(initialValues)) {
    normalized[key] = key in values ? values[key] : initialValues[key]
  }
  return normalized
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.some(hasMeaningfulValue)
  if (!value || typeof value !== "object") return false
  return Object.values(value).some(hasMeaningfulValue)
}

export function readAssignmentDraft({
  initialValues,
  raw,
}: {
  initialValues: AssignmentValues
  raw: string
}): AssignmentValues | null {
  try {
    const parsed = JSON.parse(raw) as StoredAssignmentDraft
    if (!parsed?.values || typeof parsed.values !== "object") return null

    const currentBaseSignature = serializeAssignmentValues(initialValues)
    if (typeof parsed.baseSignature === "string") {
      if (parsed.baseSignature !== currentBaseSignature) return null
    } else if (hasMeaningfulValue(initialValues)) {
      // Legacy drafts cannot prove they are newer than server data. The server wins.
      return null
    }

    return normalizeValuesToInitialSchema({
      values: parsed.values,
      initialValues,
    })
  } catch {
    return null
  }
}

export function buildAssignmentDraft({
  initialValues,
  values,
}: {
  initialValues: AssignmentValues
  values: AssignmentValues
}) {
  return JSON.stringify({
    baseSignature: serializeAssignmentValues(initialValues),
    updatedAt: new Date().toISOString(),
    values,
  } satisfies StoredAssignmentDraft)
}
