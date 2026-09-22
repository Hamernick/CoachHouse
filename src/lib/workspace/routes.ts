export const WORKSPACE_PATH = "/workspace"
export const MY_ORGANIZATION_PATH = "/my-organization"
export const WORKSPACE_ROADMAP_PATH = `${WORKSPACE_PATH}/roadmap`
export const WORKSPACE_ACCELERATOR_PATH = `${WORKSPACE_PATH}/accelerator`
export const WORKSPACE_FINANCE_DRAWER_TAB = "finance" as const
export const ORGANIZATION_DOCUMENTS_PATH = "/organization/documents"

export const WORKSPACE_DRAWER_TABS = [
  "organization",
  WORKSPACE_FINANCE_DRAWER_TAB,
  "people",
  "documents",
  "particles",
  "tools",
  "accelerator",
  "roadmap",
] as const

export type WorkspaceDrawerTab = (typeof WORKSPACE_DRAWER_TABS)[number]

export function normalizeWorkspaceDrawerTab(
  value: unknown
): WorkspaceDrawerTab | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return WORKSPACE_DRAWER_TABS.includes(normalized as WorkspaceDrawerTab)
    ? (normalized as WorkspaceDrawerTab)
    : null
}

export type WorkspaceEditorTab =
  | "company"
  | "programs"
  | "people"
  | "supporters"

export function getWorkspaceDrawerPath({
  tab,
  focus,
  moduleId,
  stepId,
  group,
  section,
}: {
  tab: WorkspaceDrawerTab
  focus?: string | null
  moduleId?: string | null
  stepId?: string | null
  group?: string | null
  section?: string | null
}) {
  const params = new URLSearchParams({ drawer: tab })

  if (focus?.trim()) {
    params.set("focus", focus.trim())
  }

  if (moduleId?.trim()) {
    params.set("module", moduleId.trim())
  }

  if (stepId?.trim()) {
    params.set("step", stepId.trim())
  }

  if (group?.trim()) {
    params.set("group", group.trim())
  }

  if (section?.trim()) {
    params.set("section", section.trim())
  }

  return `${WORKSPACE_PATH}?${params.toString()}`
}

export function getWorkspaceEditorPath({
  tab,
  programId,
  focus,
}: {
  tab: WorkspaceEditorTab
  programId?: string | null
  focus?: string | null
}) {
  const params = new URLSearchParams({
    view: "editor",
    tab,
  })

  if (programId?.trim()) {
    params.set("programId", programId.trim())
  }

  if (focus?.trim()) {
    params.set("focus", focus.trim())
  }

  return `${WORKSPACE_PATH}?${params.toString()}`
}

export function getOrganizationDocumentsPath({
  focus,
}: {
  focus?: string | null
} = {}) {
  const normalizedFocus = focus?.trim()
  if (!normalizedFocus) return ORGANIZATION_DOCUMENTS_PATH
  const params = new URLSearchParams({ focus: normalizedFocus })
  return `${ORGANIZATION_DOCUMENTS_PATH}?${params.toString()}`
}

export function getWorkspaceRoadmapSectionPath(slug: string) {
  const normalizedSlug = slug.trim()
  return normalizedSlug
    ? `${WORKSPACE_ROADMAP_PATH}/${normalizedSlug}`
    : WORKSPACE_ROADMAP_PATH
}

export function getWorkspaceRoadmapDrawerPath(slug: string) {
  return getWorkspaceDrawerPath({
    tab: "roadmap",
    section: slug,
  })
}

export function getWorkspaceAcceleratorPaywallPath(source = "accelerator") {
  const params = new URLSearchParams({
    paywall: "organization",
    plan: "organization",
    upgrade: "accelerator-access",
    source,
  })

  return `${WORKSPACE_PATH}?${params.toString()}`
}

export function getMemberWorkspacePaywallPath(source = "member-workspace") {
  const params = new URLSearchParams({
    paywall: "organization",
    plan: "organization",
    upgrade: "member-workspace-access",
    source,
  })

  return `${WORKSPACE_PATH}?${params.toString()}`
}
