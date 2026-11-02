import { getParticleCapabilityCatalog } from "@/features/workspace-particles"

/** Availability is rechecked for saved results. It does not confer permission:
 * source writers still own identity, revision, authorization and retry checks. */
export function assertResearchCapabilities(capabilities = getParticleCapabilityCatalog(), forms = false) {
  if (capabilities.version !== 1 || !capabilities.entries.some(entry => entry.id === "plan" && entry.action === "change_plan") ||
      !capabilities.entries.some(entry => entry.id === "workspace_note" && entry.action === "edit_note"))
    throw new Error("Planning outputs are unavailable. Reopen the current workspace.")
  if (forms && !capabilities.entries.some(entry => entry.id === "workspace_form" && entry.action === "edit_form"))
    throw new Error("Form drafts are unavailable. Reopen the current workspace.")
}
