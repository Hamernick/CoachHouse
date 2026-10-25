import { after } from "next/server"

import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { measureServerStep } from "@/lib/performance/server-timing"
import { trackUserJourneyMilestone } from "@/lib/user-journey"

import { resolveDashboardLayoutState } from "@/components/app-shell/dashboard-layout-state"
import MyOrganizationPageContent from "../my-organization/_lib/my-organization-page-content"
import type { MyOrganizationSearchParams } from "../my-organization/_lib/types"

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<MyOrganizationSearchParams>
}) {
  // These readers share request-scoped auth; none depends on another's result.
  const [content, state, context] = await Promise.all([
    measureServerStep(
      "workspace.page.render_organization_content",
      () => MyOrganizationPageContent({ searchParams }),
      { thresholdMs: 1_000 }
    ),
    measureServerStep(
      "workspace.page.resolve_layout_state",
      () => resolveDashboardLayoutState(),
      { thresholdMs: 250 }
    ),
    resolveOptionalAuthenticatedAppContext(),
  ])

  if (state.userPresent && !state.isAdmin && context) {
    // Capture request data during render; only analytics runs after the response.
    after(() =>
      measureServerStep(
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
      ).then(() => undefined)
    )
  }

  return content
}
