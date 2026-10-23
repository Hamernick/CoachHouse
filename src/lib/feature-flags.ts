export const publicSharingEnabled = process.env.NEXT_PUBLIC_PUBLIC_SHARING_ENABLED === "true"

function parseDefaultOnFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized !== "0" && normalized !== "false" && normalized !== "off"
}

export const platformLabEnabled = parseDefaultOnFlag(process.env.NEXT_PUBLIC_ENABLE_PLATFORM_LAB)

// Enable only after the core-document migration and two-session release check.
export const organizationDocumentCollaborationEnabled = process.env.NEXT_PUBLIC_CORE_DOCUMENT_COLLABORATION_ENABLED === "true"

export const organizationWorkspaceSupportEnabled = process.env.NEXT_PUBLIC_WORKSPACE_SUPPORT_ENABLED === "true"
