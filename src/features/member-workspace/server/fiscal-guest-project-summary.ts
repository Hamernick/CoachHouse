import type { FiscalSponsorshipApplicationRecord } from "@/features/fiscal-sponsorship"
import type { MemberWorkspaceAdminOrganizationSummary } from "../types"
import type { OrganizationProjectRecord } from "./project-starter-data"

// Adapt the applicant's own data to the existing page contract. Never load the
// internal fiscal host's profile, members, billing, programs or setup checklist.
export function fiscalGuestProjectSummary(
  project: OrganizationProjectRecord,
  application: FiscalSponsorshipApplicationRecord,
): MemberWorkspaceAdminOrganizationSummary {
  return {
    orgId: project.org_id,
    canonicalProjectId: null,
    name: application.projectName || project.name,
    ownerName: application.applicantFullName || "Guest applicant",
    ownerAvatarUrl: null,
    publicSlug: null,
    organizationStatus: "n/a",
    isPublic: false,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    acceleratorProgress: 0,
    setupProgress: 0,
    setupCompletedCount: 0,
    setupTotalCount: 0,
    missingSetupCount: 0,
    memberCount: 0,
    tags: [],
    members: [],
    setupItems: [],
    profile: {},
  }
}
