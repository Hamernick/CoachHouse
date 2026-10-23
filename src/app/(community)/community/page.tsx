import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CommunityJoinCards } from "@/components/community/community-join-cards"
import { resolveAppShellOnboardingRedirectTarget } from "@/components/app-shell/onboarding-redirect"
import { requireServerSession } from "@/lib/auth"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { publicSharingEnabled } from "@/lib/feature-flags"

export const metadata: Metadata = {
  title: "Community",
  description: "Join Coach House communities for nonprofit conversations, announcements, and coordination.",
  robots: { index: publicSharingEnabled, follow: true },
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function resolveOnboardingIntentFocus(
  value: unknown,
): "build" | "find" | "fund" | "support" | null {
  if (value === "build" || value === "find" || value === "fund" || value === "support") {
    return value
  }

  return null
}

export default async function CommunityPage() {
  let requestContext = await resolveOptionalAuthenticatedAppContext()

  if (!publicSharingEnabled && !requestContext) {
    await requireServerSession("/community")
    requestContext = await resolveOptionalAuthenticatedAppContext()
  }

  if (requestContext) {
    const userMeta = (requestContext.user.user_metadata as Record<string, unknown> | null) ?? null
    const completed = Boolean(userMeta?.onboarding_completed)
    const onboardingIntentFocus = resolveOnboardingIntentFocus(userMeta?.onboarding_intent_focus)
    const onboardingLocked =
      !requestContext.profileAudience.isAdmin &&
      !completed &&
      requestContext.activeOrg.orgId === requestContext.user.id

    const redirectTarget = resolveAppShellOnboardingRedirectTarget({
      onboardingLocked,
      onboardingIntentFocus,
      isAdminContext: false,
      pathname: "/community",
    })

    if (redirectTarget) {
      redirect(redirectTarget)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-3xl items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Community</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Join the Coach House communities</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Choose the space that fits your workflow. Discord is best for async threads and announcements, and WhatsApp is best for quick mobile coordination.
          </p>
        </div>

        <CommunityJoinCards
          className="mx-auto max-w-2xl text-left"
          title="Community invites"
          description="Open either link to join the conversation."
          showHeader={false}
        />
      </div>
    </div>
  )
}
