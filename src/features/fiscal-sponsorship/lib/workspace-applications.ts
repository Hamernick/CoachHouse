import type {
  FiscalSponsorshipApplicationPrefill,
  FiscalSponsorshipApplicationStatus,
} from "../types"
import { buildWorkspaceApplicantPrefill } from "./workspace-application-prefill"

export type FiscalWorkspaceApplication = {
  projectId: string
  name: string
  description: string | null
  status: FiscalSponsorshipApplicationStatus | null
  sourceActivityId: string | null
}

export function fiscalWorkspaceApplicationStatus(
  status: FiscalWorkspaceApplication["status"]
) {
  switch (status) {
    case "submitted":
    case "in_review":
      return { label: "In review", action: "View progress", edit: false }
    case "needs_info":
      return { label: "Changes requested", action: "Update application", edit: true }
    case "approved":
      return { label: "Approved", action: "View next steps", edit: false }
    case "agreement_ready":
      return { label: "Agreement ready", action: "View agreement", edit: false }
    case "signed":
      return { label: "Awaiting countersignature", action: "View agreement", edit: false }
    case "countersigned":
      return { label: "Agreement complete", action: "View next steps", edit: false }
    case "declined":
      return { label: "Declined", action: "View review", edit: false }
    default:
      return { label: "Draft", action: "Continue application", edit: true }
  }
}

export function workspaceApplicationPrefill(
  application: FiscalWorkspaceApplication,
  base: FiscalSponsorshipApplicationPrefill | null
): FiscalSponsorshipApplicationPrefill {
  return {
    ...buildWorkspaceApplicantPrefill(base),
    projectName: application.name,
    projectDescription: application.description,
    sourceActivityId: application.sourceActivityId,
    sourceActivityTitle: application.name,
    sourceActivityKind: "Activity",
  }
}
