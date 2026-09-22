"use client"

import { useCallback, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import BookOpenCheckIcon from "lucide-react/dist/esm/icons/book-open-check"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PublicMapMemberOnboardingOverlay } from "./member-onboarding-overlay"
import {
  buildPublicMapMemberOnboardingPreviewHref,
  isPublicMapMemberOnboardingPreviewActive,
} from "./member-onboarding-preview"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"

export type PublicMapMemberOnboardingConfig = {
  enabled: boolean
  intentFocus: "find" | "fund" | "support" | null
  hasOrganizationSwitcher: boolean
  onComplete: (form: FormData) => Promise<void>
}

export type PublicMapAdminOnboardingPreviewConfig = {
  canToggle: boolean
  hasOrganizationSwitcher: boolean
}

export type PublicMapMemberOnboardingMapOverlayState = {
  isOpen: boolean
  welcomeControl: ReactNode
  overlay: ReactNode
}

export function usePublicMapMemberOnboardingMapOverlay({
  isAuthenticated,
  memberOnboarding,
  adminOnboardingPreview,
}: {
  isAuthenticated: boolean
  memberOnboarding?: PublicMapMemberOnboardingConfig
  adminOnboardingPreview?: PublicMapAdminOnboardingPreviewConfig
}): PublicMapMemberOnboardingMapOverlayState {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const realMemberOnboardingEnabled =
    isAuthenticated && Boolean(memberOnboarding?.enabled)
  const adminOnboardingPreviewEnabled =
    isAuthenticated &&
    !realMemberOnboardingEnabled &&
    isPublicMapMemberOnboardingPreviewActive({
      canPreview: Boolean(adminOnboardingPreview?.canToggle),
      memberOnboardingParam: searchParams.get("member_onboarding"),
    })
  const showMemberOnboardingOverlay =
    realMemberOnboardingEnabled || adminOnboardingPreviewEnabled
  const handleToggleAdminOnboardingPreview = useCallback(
    (enabled: boolean) => {
      router.replace(
        buildPublicMapMemberOnboardingPreviewHref({
          pathname,
          searchParams,
          enabled,
        }),
        { scroll: false }
      )
    },
    [pathname, router, searchParams]
  )
  const adminPreviewToggle =
    isAuthenticated && adminOnboardingPreview?.canToggle ? (
      <PublicMapMemberOnboardingPreviewToggle
        active={adminOnboardingPreviewEnabled}
        onToggle={() =>
          handleToggleAdminOnboardingPreview(!adminOnboardingPreviewEnabled)
        }
      />
    ) : null
  const memberOnboardingOverlay = showMemberOnboardingOverlay ? (
    adminOnboardingPreviewEnabled && adminOnboardingPreview ? (
      <PublicMapMemberOnboardingOverlay
        intentFocus="find"
        hasOrganizationSwitcher={adminOnboardingPreview.hasOrganizationSwitcher}
        onDismiss={() => handleToggleAdminOnboardingPreview(false)}
      />
    ) : memberOnboarding ? (
      <PublicMapMemberOnboardingOverlay
        intentFocus={memberOnboarding.intentFocus}
        hasOrganizationSwitcher={memberOnboarding.hasOrganizationSwitcher}
        onSubmit={memberOnboarding.onComplete}
      />
    ) : null
  ) : null

  return {
    isOpen: showMemberOnboardingOverlay,
    welcomeControl: adminPreviewToggle,
    overlay: memberOnboardingOverlay,
  }
}

export function PublicMapMemberOnboardingPreviewToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <div
      data-public-map-welcome-control="true"
      className="pointer-events-none min-w-0 shrink-0 md:absolute md:-top-1 md:left-1/2 md:z-30 md:-translate-x-1/2"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={active}
        className={cn(
          "pointer-events-auto relative rounded-xl shadow-none backdrop-blur max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1.5 [html.light_&]:!text-zinc-950",
          PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME
        )}
        onClick={onToggle}
      >
        <BookOpenCheckIcon data-icon="inline-start" aria-hidden />
        <span className="min-w-0 truncate">Welcome</span>
      </Button>
    </div>
  )
}
