import type {
  OrgProgram,
  OrgProfile,
  ProfileTab,
} from "@/components/organization/org-profile-card/types"
import type { DocumentsTabData } from "@/components/organization/org-profile-card/tabs/documents-tab/data"
import type { OnboardingFlowDefaults } from "@/components/onboarding/onboarding-dialog/types"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type {
  FiscalSponsorshipApplicationPrefill,
  FiscalSponsorshipProjectWorkflowSummary,
} from "@/features/fiscal-sponsorship"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card"
import type { OrganizationMemberRole } from "@/lib/organization/active-org"
import type { OrganizationPeopleSegment } from "@/lib/people/segments"
import type { OrganizationPeopleTag } from "@/lib/people/tags"
import type { RoadmapSection } from "@/lib/roadmap"
import type { WorkspaceDrawerTab } from "@/lib/workspace/routes"

import type {
  FormationSummary,
  MyOrganizationCalendarView,
} from "../../_lib/types"
import type { WorkspaceActivityRecord } from "./workspace-board-communications-types"
import type {
  WorkspaceCardId,
  WorkspaceJourneyStage,
} from "./workspace-board-constants"
import type { WorkspaceBoardState } from "./workspace-board-state-types"

export type WorkspaceDurationUnit = "hours" | "days" | "months"
export type WorkspaceCollaborationInviteStatus =
  | "active"
  | "expired"
  | "revoked"

export type WorkspaceCollaborationInvite = {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  createdBy: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  durationValue: number
  durationUnit: WorkspaceDurationUnit
}

export type WorkspaceMemberOption = {
  userId: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  role: OrganizationMemberRole
  isOwner: boolean
}

export type WorkspaceJourneyReadiness = {
  organizationProfileComplete: boolean
  teammateCount: number
  workspaceDocumentCount: number
  acceleratorStarted: boolean
  acceleratorCompletedStepCount: number
}

export type WorkspaceSeedData = {
  workspaceCatalog?: Array<{ id: string | null; name: string }>
  orgId: string
  viewerId: string
  viewerName: string
  viewerAvatarUrl: string | null
  isPlatformAdmin?: boolean
  presentationMode: boolean
  role: OrganizationMemberRole
  canEdit: boolean
  canInviteCollaborators: boolean
  hasAcceleratorAccess: boolean
  organizationTitle: string
  organizationSubtitle: string
  fundingGoalCents: number
  raisedCents: number
  programsCount: number
  peopleCount: number
  journeyReadiness: WorkspaceJourneyReadiness
  initialProfile: OrgProfile
  roadmapSections: RoadmapSection[]
  formationSummary: FormationSummary
  acceleratorTimeline?: WorkspaceAcceleratorCardStep[]
  activityFeed: WorkspaceActivityRecord[]
  calendar: MyOrganizationCalendarView
  collaborationInvites: WorkspaceCollaborationInvite[]
  members: WorkspaceMemberOption[]
  boardState: WorkspaceBoardState
  initialOnboarding: {
    required: boolean
    defaults: OnboardingFlowDefaults
  }
}

export type WorkspaceOrganizationEditorData = {
  organizationLocation?: { latitude: number | null; longitude: number | null }
  initialDrawerTab: WorkspaceDrawerTab | null
  initialAcceleratorGroup: string | null
  initialAcceleratorModuleId: string | null
  initialAcceleratorStepId: string | null
  initialEditMode: boolean
  initialFocus: string | null
  initialRoadmapSectionSlug: string | null
  initialProfile: OrgProfile
  initialProfileTab: ProfileTab | null
  initialProgramId: string | null
  roadmapSections: RoadmapSection[]
  roadmapPublicSlug: string | null
  people: OrgPersonWithImage[]
  peopleSegments: OrganizationPeopleSegment[]
  peopleTags: OrganizationPeopleTag[]
  programs: OrgProgram[]
  fiscalSponsorshipProjectId: string | null
  fiscalSponsorshipWorkflowSummary: FiscalSponsorshipProjectWorkflowSummary | null
  fiscalSponsorshipApplicationPrefill: FiscalSponsorshipApplicationPrefill | null
  documentsTab: DocumentsTabData
  canEdit: boolean
}

export type WorkspaceJourneyGuideAction =
  | {
      kind: "focus-card"
      label: string
      cardId: WorkspaceCardId
    }
  | {
      kind: "open-step-node"
      label: string
    }
  | {
      kind: "open-accelerator"
      label: string
      href: string
    }

export type WorkspaceJourneyGuideState = {
  stage: WorkspaceJourneyStage
  title: string
  description: string
  checklist: [string, string, string]
  tone: "guide" | "operating"
  targetCardId: WorkspaceCardId
  primaryAction: WorkspaceJourneyGuideAction
  accentLabel: string
}
