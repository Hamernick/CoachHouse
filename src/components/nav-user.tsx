"use client"

import { useRef, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import MoreVerticalIcon from "lucide-react/dist/esm/icons/more-vertical"

import {
  resolveAppShellAccountMenuActionsForUser,
  useAppShellAccountMenuActions,
} from "@/components/app-shell/account-menu-actions-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

import { UpgradeButton } from "./nav-user/upgrade-button"

import { useNavUserMenu } from "./nav-user/hooks/use-nav-user-menu"
import { NavUserMenuContent } from "./nav-user/nav-user-menu-content"
import type { AccountSettingsTabKey } from "./account-settings/types"

const PaywallOverlay = dynamic(
  () => import("@/components/paywall/paywall-overlay").then((mod) => mod.PaywallOverlay),
  { ssr: false },
)

const AccountSettingsDialog = dynamic(
  () =>
    import("@/components/account-settings/account-settings-dialog").then(
      (mod) => ({
        default: mod.AccountSettingsDialog,
      })
    ),
  { loading: () => null, ssr: false }
)

type NavUserProps = {
  accountMenuContent?: ReactNode
  showUpgrade?: boolean
  planLabel?: string
  user: {
    name: string | null
    title?: string | null
    email: string | null
    avatar?: string | null
  }
  isAdmin?: boolean
  isTester?: boolean
  showOrgAdmin?: boolean
  canAccessOrgAdmin?: boolean
  showDivider?: boolean
  hasActiveSubscription?: boolean
}

export function NavUser({
  accountMenuContent,
  showUpgrade = false,
  planLabel,
  user,
  isAdmin = false,
  showOrgAdmin = false,
  canAccessOrgAdmin = true,
  showDivider = true,
  hasActiveSubscription = false,
}: NavUserProps) {
  const router = useRouter()
  const [signOutPending, startSignOutTransition] = useTransition()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const upgradeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<AccountSettingsTabKey>("profile")
  const registeredAccountMenuActions = useAppShellAccountMenuActions()
  const {
    menuOpen,
    setMenuOpen,
    containerRef,
    triggerRef,
    menuRef,
    menuStyle,
  } = useNavUserMenu()

  function handleSignOut() {
    setMenuOpen(false)
    startSignOutTransition(async () => {
      await fetch("/api/auth/signout", { method: "POST" })
      router.replace("/")
      router.refresh()
    })
  }

  const normalizedName = typeof user.name === "string" ? user.name.trim() : ""
  const normalizedTitle = typeof user.title === "string" ? user.title.trim() : ""
  const normalizedEmail = typeof user.email === "string" ? user.email.trim() : ""
  const displayName = normalizedName || normalizedEmail || "User"
  const displayEmail = normalizedEmail
  const displaySubtitle =
    normalizedTitle ||
    (normalizedEmail && normalizedEmail.toLowerCase() !== displayName.toLowerCase() ? normalizedEmail : "")
  const displayAvatar = user.avatar ?? null
  const avatarFallback = displayName.charAt(0).toUpperCase() || "U"
  const accountMenuActions = resolveAppShellAccountMenuActionsForUser({
    actions: registeredAccountMenuActions,
    isAdmin,
  })

  return (
    <div className={showDivider ? "border-border/60 border-t pt-2" : ""}>
      <div ref={containerRef} className="relative">
        <SidebarMenu>
          {showUpgrade ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Upgrade" aria-label="Upgrade" aria-haspopup="dialog">
                <UpgradeButton ref={upgradeTriggerRef} onClick={() => setUpgradeOpen(true)} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="mt-[10px] justify-start gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-tour="account-menu"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <Button
                ref={triggerRef}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-lg px-2 py-2 text-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                  {displayAvatar ? (
                    <AvatarImage src={displayAvatar} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="text-foreground truncate font-medium">
                    {displayName}
                  </span>
                  {displaySubtitle ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {displaySubtitle}
                    </span>
                  ) : null}
                </div>
                <MoreVerticalIcon className="text-muted-foreground size-4 group-data-[collapsible=icon]:hidden" />
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <NavUserMenuContent
          accountMenuContent={accountMenuContent}
          open={menuOpen}
          menuRef={menuRef}
          menuStyle={menuStyle}
          user={user}
          displayName={displayName}
          displayEmail={displayEmail}
          showUpgrade={showUpgrade}
          planLabel={planLabel}
          avatarFallback={avatarFallback}
          isAdmin={isAdmin}
          showOrgAdmin={showOrgAdmin}
          canAccessOrgAdmin={canAccessOrgAdmin}
          accountMenuActions={accountMenuActions}
          signOutPending={signOutPending}
          onOpenUpgrade={() => setUpgradeOpen(true)}
          onCloseMenu={() => setMenuOpen(false)}
          onOpenSettings={(tab = "profile") => {
            setMenuOpen(false)
            setSettingsInitialTab(tab)
            setSettingsOpen(true)
          }}
          onSignOut={() => {
            if (!signOutPending) {
              handleSignOut()
            }
          }}
        />
      </div>
      {showUpgrade ? (
        <PaywallOverlay
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          restoreFocus={() => (upgradeTriggerRef.current ?? triggerRef.current)?.focus()}
        />
      ) : null}
      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsInitialTab}
        defaultName={displayName}
        defaultEmail={displayEmail}
        defaultMarketingOptIn={true}
        defaultNewsletterOptIn={true}
        hasActiveSubscription={hasActiveSubscription}
      />
    </div>
  )
}
