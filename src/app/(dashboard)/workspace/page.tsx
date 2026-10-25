import type { Metadata } from "next"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { measureServerStep } from "@/lib/performance/server-timing"
import { trackUserJourneyMilestone } from "@/lib/user-journey"

import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"
import MyOrganizationPageContent from "../my-organization/_lib/my-organization-page-content"
import type { MyOrganizationSearchParams } from "../my-organization/_lib/types"

export const metadata: Metadata = {
  title: "Workspace",
  description: "Plan and manage your nonprofit work in one shared workspace.",
}


export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<MyOrganizationSearchParams>
}) {
  const [state, content] = await Promise.all([
    measureServerStep(
      "workspace.page.resolve_layout_state",
      () => resolveDashboardLayoutState(),
      { thresholdMs: 250 }
    ),
    measureServerStep(
      "workspace.page.render_organization_content",
      () => MyOrganizationPageContent({ searchParams }),
      { thresholdMs: 1_000 }
    ),
  ])

  if (state.userPresent && !state.isAdmin) {
    const context = await resolveOptionalAuthenticatedAppContext()
    if (context) {
      await measureServerStep(
        "workspace.page.track_user_journey",
        () =>
          trackUserJourneyMilestone({
            userId: context.user.id,
            orgId: context.activeOrg.orgId,
            eventName: "workspace_viewed",
            journey: "workspace_activation",
            source: "workspace_page",
            surface: "workspace",
            planTier: state.currentPlanTier,
            checkpoint: "workspace_first_viewed",
            metadata: {
              hasActiveSubscription: state.hasActiveSubscription,
              hasAcceleratorAccess: state.hasAcceleratorAccess,
              hasElectiveAccess: state.hasElectiveAccess,
              showMemberWorkspace: state.showMemberWorkspace,
              onboardingLocked: state.onboardingLocked,
              onboardingIntentFocus: state.onboardingIntentFocus,
            },
          }),
        { thresholdMs: 250 }
      )
    }
  }

  return content
}
