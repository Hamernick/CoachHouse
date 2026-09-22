export type DocumentationStageId =
  | "exploring"
  | "forming"
  | "operating"
  | "growing"

export type DocumentationNavStatus = "live" | "planned" | "design-pending"

export type DocumentationNavItem = {
  title: string
  description: string
  href?: string
  status: DocumentationNavStatus
  external?: boolean
}

export type DocumentationNavSection = {
  id: "get-started" | "best-practices" | "tools" | "resources"
  title: string
  items: DocumentationNavItem[]
}

export type DocumentationStageGuidance = {
  id: DocumentationStageId
  label: string
  question: string
  guidance: string
  actions: string[]
  checkpoint: string
}

export type DocumentationSource = {
  title: string
  publisher: string
  url: string
  note: string
}

export type FoundationGuide = {
  slug: "quickstart" | "key-concepts"
  title: string
  description: string
  eyebrow: string
  answer: string
  readingTime: string
  reviewedDate: string
  sections: Array<{
    id: string
    title: string
    introduction: string
    entries: Array<{
      title: string
      description: string
      detail?: string
    }>
  }>
  stages: DocumentationStageGuidance[]
  checklist: string[]
  sources: DocumentationSource[]
}

export type BestPracticeArticle = {
  slug: `${"best-practices" | "tools"}/${string}`
  navigationTitle: string
  title: string
  description: string
  eyebrow: string
  answer: string
  readingTime: string
  reviewedDate: string
  publishedDate: string
  modifiedDate: string
  labels: {
    definition: string
    stages: string
    example: string
    framework: string
    checklist: string
    mistakes: string
    measures: string
  }
  definition: string
  whyItMatters: string[]
  importantNote: string
  stages: DocumentationStageGuidance[]
  example: {
    name: string
    context: string
    weakLabel: string
    weak: string
    strongLabel: string
    strong: string
    reason: string
  }
  framework: Array<{
    title: string
    instruction: string
    prompt: string
  }>
  checklist: string[]
  mistakes: Array<{ mistake: string; correction: string }>
  measuresIntroduction: string
  measures: string[]
  sources: DocumentationSource[]
  disclaimer: string
  previous?: { title: string; href: string }
  next?: { title: string; href?: string }
}

export type ComplianceReceiptsBand =
  | "normally-50k-or-less"
  | "under-200k"
  | "200k-or-more"

export type ComplianceAssetsBand = "under-500k" | "500k-or-more"

export type ComplianceRhythmDraft = {
  version: 1
  stateCode: string
  taxYearEnd: string
  receiptsBand: ComplianceReceiptsBand
  assetsBand: ComplianceAssetsBand
  solicitsContributions: boolean
  hasEmployees: boolean
}

export type ComplianceTask = {
  id: string
  category: "Federal" | "State" | "Governance" | "Records" | "Employment"
  status: "Common requirement" | "Conditional" | "Recommended practice"
  task: string
  timing: string
  evidence: string
}

export type FundraisingChannelId =
  | "individuals"
  | "foundations"
  | "government"
  | "corporate"
  | "events"

export type FundraisingChannelTargets = Record<FundraisingChannelId, number>

export type FundraisingPlanDraft = {
  version: 1
  organizationName: string
  stage: DocumentationStageId
  periodMonths: 3 | 6 | 12 | 18
  fundingGoal: number
  committedFunds: number
  channelTargets: FundraisingChannelTargets
  hasCaseForSupport: boolean
  hasGiftAcknowledgmentProcess: boolean
}

export type FundraisingPlanSummary = {
  fundingNeed: number
  plannedTotal: number
  remainingGap: number
  overplannedAmount: number
  monthlyPace: number
}

export type FundraisingPlanAction = {
  id: string
  phase: "Foundation" | "Relationships" | "Ask" | "Stewardship" | "Systems"
  action: string
  evidence: string
}

export type MarketingObjectiveId =
  | "service-access"
  | "community-awareness"
  | "event-participation"
  | "volunteer-recruitment"
  | "donor-engagement"
  | "partner-development"

export type MarketingChannelId =
  | "email"
  | "website"
  | "social"
  | "partners"
  | "events"
  | "media"

export type MarketingChannelCadence = Record<MarketingChannelId, number>

export type MarketingPlanDraft = {
  version: 1
  organizationName: string
  campaignName: string
  stage: DocumentationStageId
  objective: MarketingObjectiveId
  primaryAudience: string
  mainMessage: string
  proofPoint: string
  invitation: string
  channelCadence: MarketingChannelCadence
  hasStoryPermissionProcess: boolean
  hasContentReviewProcess: boolean
  hasLinkTrackingConvention: boolean
}

export type MarketingPlanSummary = {
  activeChannelCount: number
  monthlyOutputs: number
  ninetyDayOutputs: number
  weeklyPace: number
  hasCoreBrief: boolean
}

export type MarketingPlanAction = {
  id: string
  phase:
    | "Foundation"
    | "Audience"
    | "Content"
    | "Distribution"
    | "Governance"
    | "Measurement"
  action: string
  evidence: string
}

export type FrameworkQuestionId =
  | "understand-system"
  | "explain-change"
  | "plan-program"
  | "clarify-ownership"
  | "learn-and-adapt"

export type NonprofitFrameworkId =
  | "systems-map"
  | "theory-of-change"
  | "logic-model"
  | "responsibility-map"
  | "learning-cycle"

export type LogicModelDraft = {
  version: 1
  organizationName: string
  programName: string
  stage: DocumentationStageId
  primaryQuestion: FrameworkQuestionId
  need: string
  people: string
  inputs: string
  activities: string
  outputs: string
  nearTermOutcomes: string
  intermediateOutcomes: string
  longTermContribution: string
  assumptions: string
  context: string
  learningQuestion: string
}

export type LogicModelSummary = {
  draftedAreaCount: number
  totalAreaCount: number
  causalLinkCount: number
  hasCompletePathway: boolean
}

export type LogicModelAction = {
  id: string
  phase: "Context" | "Pathway" | "Evidence" | "Governance"
  action: string
  evidence: string
}

export type MeasurementDecisionId =
  | "improve-delivery"
  | "understand-reach"
  | "assess-near-term-outcome"
  | "assess-intermediate-outcome"
  | "report-accountability"
  | "consider-expansion"

export type MeasurementOutcomeLevel =
  | "implementation"
  | "output"
  | "near-term"
  | "intermediate"
  | "long-term-contribution"

export type MeasurementMethodId =
  | "administrative-records"
  | "survey"
  | "interview-listening"
  | "observation"
  | "partner-data"
  | "public-data"
  | "mixed-methods"

export type MeasurementPlanDraft = {
  version: 1
  organizationName: string
  programName: string
  stage: DocumentationStageId
  decision: MeasurementDecisionId
  outcomeLevel: MeasurementOutcomeLevel
  outcomeStatement: string
  evaluationQuestion: string
  indicatorDefinition: string
  method: MeasurementMethodId
  dataSource: string
  collectionSchedule: string
  expectedRespondents: number
  minutesPerResponse: number
  cyclesPerYear: number
  disaggregationPlan: string
  limitations: string
  owner: string
  actionRule: string
  hasDataMinimizationReview: boolean
  hasAccessibleVoluntaryProcess: boolean
  hasParticipantInterpretation: boolean
}

export type MeasurementPlanSummary = {
  draftedAreaCount: number
  totalAreaCount: number
  annualResponses: number
  annualRespondentHours: number
  hasDecisionReadyChain: boolean
}

export type MeasurementPlanAction = {
  id: string
  phase: "Purpose" | "Definition" | "Evidence" | "Ethics" | "Use"
  action: string
  evidence: string
}

export type SustainabilityDirectionId =
  | "maintain"
  | "stabilize"
  | "transition"
  | "grow"
  | "responsible-close"

export type SustainabilityHorizonMonths = 6 | 12 | 18 | 24 | 36

export type SustainabilityPlanDraft = {
  version: 1
  organizationName: string
  initiativeName: string
  stage: DocumentationStageId
  direction: SustainabilityDirectionId
  horizonMonths: SustainabilityHorizonMonths
  unrestrictedCash: number
  expectedUnrestrictedRevenue: number
  restrictedFunds: number
  monthlyCoreCosts: number
  monthlyProgramCosts: number
  weeklyAvailableHours: number
  weeklyCommittedHours: number
  missionPriority: string
  essentialCommitments: string
  fundingAssumptions: string
  peopleDependencies: string
  systemsDependencies: string
  adaptationTriggers: string
  continuityOwner: string
  reviewRhythm: string
  hasBoardFinancialReview: boolean
  hasRestrictionReview: boolean
  hasContinuityPlan: boolean
}

export type SustainabilityPlanSummary = {
  monthlyPlannedCost: number
  horizonPlannedCost: number
  flexibleResources: number
  projectedFlexibleBalance: number
  startingRunwayMonths: number
  weeklyCapacityBalance: number
  draftedAreaCount: number
  totalAreaCount: number
  hasReviewableScenario: boolean
}

export type SustainabilityPlanAction = {
  id: string
  phase: "Mission" | "Money" | "People" | "Continuity" | "Governance"
  action: string
  evidence: string
}

export type PartnershipModelId =
  | "referral"
  | "co-delivery"
  | "shared-resource"
  | "joint-campaign"
  | "strategic-alliance"

export type PartnershipTermMonths = 3 | 6 | 12 | 18 | 24

export type PartnershipReviewMonths = 1 | 3 | 6 | 12

export type PartnershipBriefDraft = {
  version: 1
  organizationName: string
  partnerName: string
  partnershipName: string
  stage: DocumentationStageId
  model: PartnershipModelId
  termMonths: PartnershipTermMonths
  reviewEveryMonths: PartnershipReviewMonths
  sharedPurpose: string
  communityRole: string
  organizationContribution: string
  partnerContribution: string
  jointActivities: string
  intendedResult: string
  decisionRights: string
  financialTerms: string
  dataBoundaries: string
  communicationRhythm: string
  conflictPath: string
  closeoutPlan: string
  organizationLead: string
  partnerLead: string
  hasConflictReview: boolean
  hasDataReview: boolean
  hasAccessibilityPlan: boolean
  hasAuthorizedApproval: boolean
}

export type PartnershipBriefSummary = {
  draftedAreaCount: number
  totalAreaCount: number
  reviewMomentCount: number
  safeguardCount: number
  totalSafeguardCount: number
  hasReviewableBrief: boolean
}

export type PartnershipBriefAction = {
  id: string
  phase:
    | "Purpose"
    | "People"
    | "Work"
    | "Governance"
    | "Safeguards"
    | "Learning"
    | "Closeout"
  action: string
  evidence: string
}

export type SocialMediaObjectiveId =
  | "service-access"
  | "community-education"
  | "event-participation"
  | "volunteer-recruitment"
  | "donor-stewardship"
  | "partner-development"

export type SocialMediaChannelId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "bluesky"
  | "other"

export type SocialMediaChannelCadence = Record<SocialMediaChannelId, number>

export type SocialMediaPlanDraft = {
  version: 1
  organizationName: string
  campaignName: string
  stage: DocumentationStageId
  objective: SocialMediaObjectiveId
  campaignWeeks: 4 | 8 | 12
  primaryAudience: string
  desiredAction: string
  destinationUrl: string
  mainMessage: string
  sourceEvidence: string
  storyPermissionContext: string
  voiceGuidance: string
  postCopy: string
  visualDescription: string
  alternativeText: string
  captionsPlan: string
  linkLabel: string
  responseProtocol: string
  approvalOwner: string
  escalationOwner: string
  previewChannel: SocialMediaChannelId
  channelCadence: SocialMediaChannelCadence
  hasStoryPermissionReview: boolean
  hasClaimSourceReview: boolean
  hasAccessibilityReview: boolean
  hasApprovalEscalationPlan: boolean
}

export type SocialMediaPlanSummary = {
  activeChannelCount: number
  weeklyOutputs: number
  campaignOutputs: number
  draftedAreaCount: number
  totalAreaCount: number
  safeguardCount: number
  totalSafeguardCount: number
}

export type SocialMediaPlanAction = {
  id: string
  phase:
    | "Purpose"
    | "Audience"
    | "Source"
    | "Access"
    | "Publishing"
    | "Response"
    | "Learning"
  action: string
  evidence: string
}

export type NetworkingObjectiveId =
  | "community-listening"
  | "referral-pathway"
  | "peer-learning"
  | "funding-relationships"
  | "advocacy-policy"
  | "volunteer-talent"

export type NetworkingRelationshipCategoryId =
  | "community"
  | "peer-nonprofit"
  | "public-agency"
  | "funder"
  | "business-professional"
  | "advocate-media"
  | "other"

export type NetworkingEngagementId =
  | "listen"
  | "learn"
  | "exchange"
  | "coordinate"
  | "collaborate"

export type NetworkingRelationshipDraft = {
  id: string
  label: string
  category: NetworkingRelationshipCategoryId
  engagement: NetworkingEngagementId
  purpose: string
  theirContext: string
  responsibleOffer: string
  nextStep: string
  owner: string
  reviewTiming: string
}

export type NetworkingPlanDraft = {
  version: 1
  organizationName: string
  initiativeName: string
  stage: DocumentationStageId
  objective: NetworkingObjectiveId
  reviewWeeks: 4 | 8 | 12
  networkingPurpose: string
  communityAccountability: string
  existingAssets: string
  relationshipGaps: string
  invitation: string
  followUpRhythm: string
  accessPlan: string
  dataBoundary: string
  planOwner: string
  escalationPath: string
  relationships: NetworkingRelationshipDraft[]
  hasCommunityVoiceReview: boolean
  hasConsentDataReview: boolean
  hasAccessibilityReview: boolean
  hasAuthorityConflictReview: boolean
}

export type NetworkingPlanSummary = {
  relationshipCount: number
  representedCategoryCount: number
  representedEngagementCount: number
  nextStepCount: number
  draftedAreaCount: number
  totalAreaCount: number
  safeguardCount: number
  totalSafeguardCount: number
}

export type NetworkingPlanAction = {
  id: string
  phase:
    | "Purpose"
    | "Community"
    | "Map"
    | "Exchange"
    | "Follow-up"
    | "Safeguards"
    | "Learning"
  action: string
  evidence: string
}

export type BrandIdentityColor = {
  id: "canvas" | "brand" | "utility" | "ink"
  role: "Background" | "Primary" | "Secondary" | "Text"
  name: string
  value: string
  proportion: number
}

export type BrandIdentityDraft = {
  version: 1
  organizationName: string
  tagline: string
  introduction: string
  purpose: string
  audience: string
  actionables: [string, string, string]
  logoGuidance: string
  colors: BrandIdentityColor[]
  headingFont: string
  bodyFont: string
  baseSize: number
  typeRatio: number
  campaignHeadline: string
  campaignBody: string
  updatedAt: string
}

export type BrandAssetId =
  | "primary-logo"
  | "brand-mark"
  | "application-image"
  | "application-vertical-image"
  | `illustration-${1 | 2 | 3 | 4 | 5 | 6}`

export type StoredBrandAsset = {
  id: BrandAssetId
  name: string
  type: string
  blob: Blob
  updatedAt: string
}
