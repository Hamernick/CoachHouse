import type { OrgPerson } from "@/actions/people"
import type {
  OrgProfile,
  OrgProgram,
  ProfileTab,
} from "@/components/organization/org-profile-card/types"
import { buildDocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { FiscalSponsorshipProjectWorkflowSummary } from "@/features/fiscal-sponsorship"
import { resolvePeopleDisplayImages } from "@/lib/people/display-images"
import type { OrganizationPeopleSegment } from "@/lib/people/segments"
import type { OrganizationPeopleTag } from "@/lib/people/tags"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceDrawerTab } from "@/lib/workspace/routes"
import { buildFiscalSponsorshipApplicationPrefill } from "./workspace-fiscal-sponsorship-prefill"

export async function buildWorkspaceOrganizationEditorData({
  applicantEmail,
  applicantFullName,
  canAccessRoadmapDocuments,
  canEdit,
  fiscalSponsorshipProjectId,
  fiscalSponsorshipWorkflowSummary,
  initialAcceleratorGroup,
  initialAcceleratorModuleId,
  initialAcceleratorStepId,
  initialDrawerTab,
  initialEditMode,
  initialFocus,
  initialRoadmapSectionSlug,
  initialProfile,
  initialProfileTab,
  initialProgramId,
  organizationLocation,
  peopleNormalized,
  peopleSegments,
  peopleTags,
  profile,
  programs,
  publicSlug,
  roadmapSections,
}: {
  applicantEmail?: string | null
  applicantFullName?: string | null
  canAccessRoadmapDocuments: boolean
  canEdit: boolean
  fiscalSponsorshipProjectId: string | null
  fiscalSponsorshipWorkflowSummary: FiscalSponsorshipProjectWorkflowSummary | null
  initialAcceleratorGroup: string | null
  initialAcceleratorModuleId: string | null
  initialAcceleratorStepId: string | null
  initialDrawerTab: WorkspaceDrawerTab | null
  initialEditMode: boolean
  initialFocus: string | null
  initialRoadmapSectionSlug: string | null
  initialProfile: OrgProfile
  initialProfileTab: ProfileTab | null
  initialProgramId: string | null
  organizationLocation?: { latitude: number | null; longitude: number | null }
  peopleNormalized: OrgPerson[]
  peopleSegments: OrganizationPeopleSegment[]
  peopleTags: OrganizationPeopleTag[]
  profile: Record<string, unknown>
  programs: OrgProgram[] | null | undefined
  publicSlug: string | null
  roadmapSections: RoadmapSection[]
}) {
  const people = await resolvePeopleDisplayImages(peopleNormalized)
  const orgPrograms = programs ?? []

  return {
    initialAcceleratorGroup,
    initialAcceleratorModuleId,
    initialAcceleratorStepId,
    initialDrawerTab,
    initialEditMode,
    initialFocus,
    initialRoadmapSectionSlug,
    initialProfile,
    initialProfileTab,
    initialProgramId,
    organizationLocation,
    roadmapSections,
    roadmapPublicSlug: publicSlug,
    people,
    peopleSegments,
    peopleTags,
    programs: orgPrograms,
    fiscalSponsorshipProjectId,
    fiscalSponsorshipWorkflowSummary,
    fiscalSponsorshipApplicationPrefill:
      buildFiscalSponsorshipApplicationPrefill({
        applicantEmail,
        applicantFullName,
        initialProfile,
        programs: orgPrograms,
      }),
    documentsTab: buildDocumentsTabData({
      canAccessRoadmapDocuments,
      profile,
      programs: orgPrograms,
      publicSlug,
      roadmapSections,
    }),
    canEdit,
  }
}
