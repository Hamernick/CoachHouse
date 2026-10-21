import Link from "next/link"
import { createPortal } from "react-dom"
import type { CSSProperties, ReactNode, RefObject } from "react"

import CircleUserIcon from "lucide-react/dist/esm/icons/circle-user"
import CreditCardIcon from "lucide-react/dist/esm/icons/credit-card"
import IdCardIcon from "lucide-react/dist/esm/icons/id-card"
import LogOutIcon from "lucide-react/dist/esm/icons/log-out"
import { UpgradeButton } from "./upgrade-button"
import ShieldIcon from "lucide-react/dist/esm/icons/shield"

import type { AppShellAccountMenuAction } from "@/components/app-shell/account-menu-actions-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { AccountSettingsTabKey } from "@/components/account-settings/types"

type NavUserMenuContentProps = {
  accountMenuContent?: ReactNode
  showUpgrade?: boolean
  planLabel?: string
  open: boolean
  menuRef: RefObject<HTMLDivElement | null>
  menuStyle: CSSProperties | null
  user: {
    avatar?: string | null
  }
  displayName: string
  displayEmail: string
  avatarFallback: string
  isAdmin: boolean
  showOrgAdmin: boolean
  canAccessOrgAdmin: boolean
  accountMenuActions?: AppShellAccountMenuAction[]
  signOutPending: boolean
  onOpenUpgrade: () => void
  onCloseMenu: () => void
  onOpenSettings: (tab?: AccountSettingsTabKey) => void
  onSignOut: () => void
}

export function NavUserMenuContent({
  accountMenuContent,
  showUpgrade = false,
  planLabel,
  open,
  menuRef,
  menuStyle,
  user,
  displayName,
  displayEmail,
  avatarFallback,
  isAdmin,
  showOrgAdmin,
  canAccessOrgAdmin,
  accountMenuActions = [],
  signOutPending,
  onOpenUpgrade,
  onCloseMenu,
  onOpenSettings,
  onSignOut,
}: NavUserMenuContentProps) {
  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={menuStyle ?? undefined}
      className="border-border bg-popover z-50 w-60 rounded-lg border p-2 text-sm shadow-lg"
    >
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <Avatar className="h-8 w-8 rounded-lg">
          {user.avatar ? (
            <AvatarImage src={user.avatar} alt={displayName} />
          ) : null}
          <AvatarFallback className="rounded-lg">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col text-left text-sm leading-tight">
          <span className="text-foreground truncate font-medium">
            {displayName}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {planLabel ?? displayEmail}
          </span>
        </div>
      </div>
      <div className="bg-border/60 my-2 h-px" />
      {accountMenuContent ? <div className="mb-2">{accountMenuContent}</div> : null}
      {showUpgrade ? (
        <UpgradeButton className="mb-1" onClick={() => { onCloseMenu(); onOpenUpgrade() }} />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left"
        onClick={() => onOpenSettings("public-profile")}
      >
        <IdCardIcon className="size-4" />
        Public profile
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left"
        onClick={() => onOpenSettings("profile")}
      >
        <CircleUserIcon className="size-4" />
        Account settings
      </Button>
      {showOrgAdmin && canAccessOrgAdmin ? (
        <Link
          href="/admin"
          className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition"
          onClick={onCloseMenu}
        >
          <ShieldIcon className="size-4" />
          Admin
        </Link>
      ) : null}
      {accountMenuActions.map((action) => {
        const ActionIcon = action.icon

        return (
          <Button
            key={action.id}
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left"
            onClick={() => {
              onCloseMenu()
              action.onSelect()
            }}
          >
            {ActionIcon ? (
              <ActionIcon className="size-4" aria-hidden />
            ) : null}
            {action.label}
          </Button>
        )
      })}
      {!isAdmin ? (
        <Link
          href="/billing"
          className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition"
          onClick={onCloseMenu}
        >
          <CreditCardIcon className="size-4" />
          Billing
        </Link>
      ) : null}
      <div className="bg-border/60 my-2 h-px" />
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-left"
        onClick={onSignOut}
      >
        <LogOutIcon className="size-4" />
        {signOutPending ? "Signing out..." : "Log out"}
      </Button>
    </div>,
    document.body,
  )
}
