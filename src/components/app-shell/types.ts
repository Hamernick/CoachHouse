import type { ReactNode } from "react"

import type { SidebarClass } from "@/lib/academy"
import type { PricingPlanTier } from "@/lib/billing/plan-tier"
import type { PlatformAccessLevel } from "@/features/platform-access"

export type AppShellProps = {
  children: ReactNode
  breadcrumbs?: ReactNode
  sidebarHeaderContent?: ReactNode
  accountMenuContent?: ReactNode
  sidebarTree: SidebarClass[]
  user?: {
    name: string | null
    title?: string | null
    email: string | null
    avatar?: string | null
  } | null
  isAdmin: boolean
  platformAccessLevel?: PlatformAccessLevel | null
  hasCoachingAccess?: boolean
  isTester?: boolean
  showOrgAdmin?: boolean
  canAccessOrgAdmin?: boolean
  showLiveBadges?: boolean
  acceleratorProgress?: number | null
  showAccelerator?: boolean
  hasActiveSubscription?: boolean
  hasBillingCancellationRisk?: boolean
  hasAcceleratorAccess?: boolean
  hasElectiveAccess?: boolean
  ownedElectiveModuleSlugs?: string[]
  currentPlanTier?: PricingPlanTier
  organizationName?: string | null
  onboardingLocked?: boolean
  onboardingIntentFocus?: "build" | "find" | "fund" | "support" | null
  context?: "platform" | "accelerator" | "public" | "admin"
  contentPresentation?: "default" | "full-bleed"
  defaultSidebarOpen?: boolean
  resizableRightRail?: boolean
  formationStatus?: string | null
  brandHref?: string
  showWorkspaceHome?: boolean
  showMemberWorkspace?: boolean
}
