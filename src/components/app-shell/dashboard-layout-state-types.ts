import type { SidebarClass } from "@/lib/academy"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import type { OnboardingFlowDefaults } from "@/components/onboarding/onboarding-dialog/types"
import type { AppPricingFeedbackPromptState } from "@/features/app-pricing-feedback"
import type { MemberWorkspaceHeaderState } from "@/features/member-workspace"
import type { PlatformAccessLevel } from "@/features/platform-access"

export type DashboardLayoutState = {
  organizationScope?: { orgId: string; supportAccess?: boolean; presenceOrganizationId?: string }
  userPresent: boolean
  sidebarTree: SidebarClass[]
  user: {
    name: string | null
    title: string | null
    email: string | null
    avatar: string | null
  }
  isAdmin: boolean
  platformAccessLevel: PlatformAccessLevel | null
  hasCoachingAccess: boolean
  isTester: boolean
  showOrgAdmin: boolean
  canAccessOrgAdmin: boolean
  acceleratorProgress: number | null
  showAccelerator: boolean
  showLiveBadges: boolean
  hasActiveSubscription: boolean
  hasBillingCancellationRisk: boolean
  hasAcceleratorAccess: boolean
  hasElectiveAccess: boolean
  ownedElectiveModuleSlugs: string[]
  currentPlanTier: PricingPlanTier
  showMemberWorkspace: boolean
  organizationName: string | null
  tutorialWelcome: {
    platform: boolean
    accelerator: boolean
  }
  appPricingFeedbackPrompt: AppPricingFeedbackPromptState | null
  onboardingDefaults: OnboardingFlowDefaults & {
    open: boolean
  }
  onboardingLocked: boolean
  onboardingMode: "post_signup_access" | "workspace_setup"
  onboardingIntentFocus: "build" | "find" | "fund" | "support" | null
  formationStatus: string | null
  memberWorkspaceHeader: MemberWorkspaceHeaderState | null
  memberMapOnboarding: {
    hasOrganizationSwitcher: boolean
  }
}

export const EMPTY_STATE: DashboardLayoutState = {
  userPresent: false,
  sidebarTree: [],
  user: {
    name: null,
    title: null,
    email: null,
    avatar: null,
  },
  isAdmin: false,
  platformAccessLevel: null,
  hasCoachingAccess: false,
  isTester: false,
  showOrgAdmin: false,
  canAccessOrgAdmin: false,
  acceleratorProgress: null,
  showAccelerator: false,
  showLiveBadges: false,
  hasActiveSubscription: false,
  hasBillingCancellationRisk: false,
  hasAcceleratorAccess: false,
  hasElectiveAccess: false,
  ownedElectiveModuleSlugs: [],
  currentPlanTier: "free",
  showMemberWorkspace: false,
  organizationName: null,
  tutorialWelcome: {
    platform: false,
    accelerator: false,
  },
  appPricingFeedbackPrompt: null,
  onboardingDefaults: {
    open: false,
  },
  onboardingLocked: false,
  onboardingMode: "post_signup_access",
  onboardingIntentFocus: null,
  formationStatus: null,
  memberWorkspaceHeader: null,
  memberMapOnboarding: {
    hasOrganizationSwitcher: false,
  },
}
