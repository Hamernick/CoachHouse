import type { FormationStatus } from "./org-profile-brand-types"

export type FormationStatusOption = {
  value: FormationStatus
  label: string
  description: string
}

export const FORMATION_STATUS_OPTIONS: FormationStatusOption[] = [
  {
    value: "pre_501c3",
    label: "Pre-501(c)(3)",
    description: "Just getting started.",
  },
  {
    value: "in_progress",
    label: "In progress",
    description: "Formation is underway.",
  },
  {
    value: "approved",
    label: "Approved",
    description: "We have a determination letter.",
  },
]

const FORMATION_STATUS_LOOKUP = new Map(
  FORMATION_STATUS_OPTIONS.map((option) => [option.value, option] as const),
)

export function isFormationStatus(value: unknown): value is FormationStatus {
  return value === "pre_501c3" || value === "in_progress" || value === "approved"
}

export function resolveFormationStatusOption(value: unknown) {
  if (!isFormationStatus(value)) return null
  return FORMATION_STATUS_LOOKUP.get(value) ?? null
}

export function getApprovedFormationEinError(status: unknown, ein: unknown): string | null {
  if (status !== "approved") return null
  if (typeof ein !== "string" || !ein.trim()) {
    return "Enter an EIN to save an approved organization."
  }
  return /^[0-9]{2}-?[0-9]{7}$/.test(ein.trim())
    ? null
    : "EIN must be 9 digits (e.g., 12-3456789)"
}
