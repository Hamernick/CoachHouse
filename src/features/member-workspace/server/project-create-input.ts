import { projectOptionSettingsSchema, type ProjectOptionSettings } from "../lib/project-option-settings"
import type { MemberWorkspaceCreateProjectFormInput } from "../types"
import type {
  PlatformAdminDashboardLabPriority,
  PlatformAdminDashboardLabStatus,
} from "@/features/platform-admin-dashboard"

export type MemberWorkspaceNormalizedCreateProjectInput = {
  name: string
  description: string | null
  overviewDocumentHtml: string | null
  hasOverviewDocumentHtml: boolean
  status: PlatformAdminDashboardLabStatus
  priority: PlatformAdminDashboardLabPriority
  startDate: string
  endDate: string
  clientName: string | null
  typeLabel: string | null
  durationLabel: string
  optionSettings?: ProjectOptionSettings
  tags: string[]
  memberLabels: string[]
}

function parseList(value: string | undefined) {
  if (!value) return []
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  )
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatDurationLabel(startDate: string, endDate: string) {
  const start = toUtcDate(startDate)
  const end = toUtcDate(endDate)
  const diffInDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  )

  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"}`
  }

  if (diffInDays < 31) {
    const weeks = Math.max(1, Math.round(diffInDays / 7))
    return `${weeks} week${weeks === 1 ? "" : "s"}`
  }

  const months = Math.max(1, Math.round(diffInDays / 30))
  return `${months} month${months === 1 ? "" : "s"}`
}

export function normalizeMemberWorkspaceCreateProjectInput(
  input: MemberWorkspaceCreateProjectFormInput
):
  | { ok: true; value: MemberWorkspaceNormalizedCreateProjectInput }
  | { ok: false; error: string } {
  const name = input.name.trim()
  if (!name) {
    return { ok: false, error: "Project name is required." }
  }

  if (!input.startDate || !input.endDate) {
    return { ok: false, error: "Start and end dates are required." }
  }

  const start = toUtcDate(input.startDate)
  const end = toUtcDate(input.endDate)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Enter valid project dates." }
  }

  if (end.getTime() < start.getTime()) {
    return {
      ok: false,
      error: "End date must be on or after the start date.",
    }
  }

  const settings = input.optionSettings === undefined ? undefined : projectOptionSettingsSchema.safeParse(input.optionSettings)
  if (settings && !settings.success) return { ok: false, error: "Check option names and colors." }

  return {
    ok: true,
    value: {
      ...(settings?.success ? { optionSettings: settings.data } : {}),
      name,
      description: input.description?.trim() ? input.description.trim() : null,
      overviewDocumentHtml:
        typeof input.overviewDocumentHtml === "string"
          ? input.overviewDocumentHtml.trim()
          : null,
      hasOverviewDocumentHtml: typeof input.overviewDocumentHtml === "string",
      status: input.status,
      priority: input.priority,
      startDate: input.startDate,
      endDate: input.endDate,
      clientName: input.clientName?.trim() ? input.clientName.trim() : null,
      typeLabel: input.typeLabel?.trim() ? input.typeLabel.trim() : null,
      durationLabel: input.durationLabel?.trim()
        ? input.durationLabel.trim()
        : formatDurationLabel(input.startDate, input.endDate),
      tags: parseList(input.tags),
      memberLabels: parseList(input.memberLabels),
    },
  }
}
