"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { PaywallOverlay } from "@/components/paywall/paywall-overlay"
import { HeaderActionsPortal } from "@/components/header-actions-portal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME } from "@/components/workspace/workspace-tutorial-theme"
import { cn } from "@/lib/utils"

import { useWorkspaceBoardOrganizationAccessState } from "./workspace-board-organization-access-state"
import { WorkspaceSidebarInviteBridge } from "./workspace-sidebar-invite-bridge"
import { WorkspaceBoardTeamAccessHoverCard } from "./workspace-board-team-access-hover-card"
import {
  buildWorkspaceAccessPeople,
  countActiveWorkspaceInvites,
  countPendingWorkspaceTeamAccess,
  listPendingWorkspaceAccessRequests,
  listPendingWorkspaceTeamInvites,
  resolveWorkspaceTeamAccessSummary,
} from "./workspace-board-team-access"
import type {
  WorkspaceCollaborationInvite,
  WorkspaceMemberOption,
} from "./workspace-board-types"
import { WorkspaceTutorialCallout } from "./workspace-tutorial-callout"

type WorkspaceBoardTeamAccessHeaderActionProps = {
  canInvite: boolean
  members: WorkspaceMemberOption[]
  invites: WorkspaceCollaborationInvite[]
  realtimeState: "connecting" | "live" | "degraded"
  currentUser: {
    id: string
    name: string
    avatarUrl: string | null
  }
  tutorialCallout?: {
    title: string
    instruction: string
  } | null
  onInvitesChange: (nextInvites: WorkspaceCollaborationInvite[]) => void
}

function toInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts.at(-1)!.slice(0, 1)}`.toUpperCase()
}

function hueFromSeed(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

export function WorkspaceBoardTeamAccessHeaderActionContent({
  canInvite,
  members,
  invites,
  realtimeState,
  currentUser,
  tutorialCallout,
  onInvitesChange,
}: WorkspaceBoardTeamAccessHeaderActionProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const organizationAccessState = useWorkspaceBoardOrganizationAccessState()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const requiresUpgrade =
    !organizationAccessState.loading &&
    !organizationAccessState.loadError &&
    !organizationAccessState.hasPaidTeamAccess

  useEffect(() => {
    setNowMs(Date.now())
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => globalThis.clearInterval(timer)
  }, [])

  const activeInviteCount = countActiveWorkspaceInvites(invites, nowMs)
  const pendingTeamInvites = useMemo(
    () =>
      listPendingWorkspaceTeamInvites(
        organizationAccessState.invites,
        nowMs
      ).slice(0, 4),
    [nowMs, organizationAccessState.invites]
  )
  const pendingAccessRequests = useMemo(
    () =>
      listPendingWorkspaceAccessRequests(
        organizationAccessState.requests,
        nowMs
      ).slice(0, 4),
    [nowMs, organizationAccessState.requests]
  )
  const pendingTeamAccessCount = countPendingWorkspaceTeamAccess({
    invites: organizationAccessState.invites,
    requests: organizationAccessState.requests,
    nowMs,
  })
  const accessPeople = useMemo(
    () => buildWorkspaceAccessPeople({ currentUser, members }),
    [currentUser, members]
  )
  const activeInviteRows = useMemo(
    () =>
      invites
        .filter((invite) => {
          if (invite.revokedAt) return false
          const expiresAt = new Date(invite.expiresAt).getTime()
          return Number.isFinite(expiresAt) && expiresAt > nowMs
        })
        .slice(0, 6),
    [invites, nowMs]
  )
  const visiblePeople = accessPeople.slice(0, 4)
  const extraPeopleCount = Math.max(
    0,
    accessPeople.length - visiblePeople.length
  )
  const realtimeLabel =
    realtimeState === "live"
      ? "Live"
      : realtimeState === "connecting"
        ? "Connecting…"
        : "Realtime degraded"
  const summaryText = resolveWorkspaceTeamAccessSummary({
    accessPeopleCount: accessPeople.length,
    activeInviteCount,
    pendingTeamAccessCount,
    organizationAccessLoading: organizationAccessState.loading,
    organizationAccessError: Boolean(organizationAccessState.loadError),
  })

  const trigger = (
    <Button

      ref={triggerRef}
      onClick={requiresUpgrade ? () => setUpgradeOpen(true) : undefined}
      aria-haspopup={requiresUpgrade ? "dialog" : undefined}
      type="button"
      variant="ghost"
      size="sm"
      className="border-border/65 bg-card hover:bg-muted/20 mr-2 h-9 max-w-[13rem] min-w-0 rounded-full border py-1 pr-2 pl-1 text-left transition-colors"
      aria-label={`Team access. ${summaryText}. ${realtimeLabel}.`}
    >
      <span className="flex min-w-0 items-center">
        <span className="flex -space-x-2 pr-1">
          {visiblePeople.map((person) => {
            const hue = hueFromSeed(person.id)
            return (
              <Avatar
                key={person.id}
                className="border-card size-7 border-2"
                title={`${person.name} · ${person.subtitle}`}
                aria-label={person.name}
              >
                {person.avatarUrl ? (
                  <AvatarImage src={person.avatarUrl} alt={person.name} />
                ) : null}
                <AvatarFallback
                  className="text-[10px] font-semibold"
                  style={{
                    backgroundColor: `hsl(${hue} 28% 88%)`,
                    color: `hsl(${hue} 32% 26%)`,
                  }}
                >
                  {toInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            )
          })}
          {extraPeopleCount > 0 ? (
            <span className="border-card bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold">
              +{extraPeopleCount}
            </span>
          ) : null}
        </span>
      </span>

      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 pr-1 text-[11px]">
        <span
          aria-hidden
          className={cn(
            "bg-muted-foreground/70 size-1.5 shrink-0 rounded-full",
            realtimeState === "live" && "bg-emerald-500",
            realtimeState === "connecting" &&
              "animate-pulse motion-reduce:animate-none",
            realtimeState === "degraded" && "bg-amber-500"
          )}
        />
        <span className="hidden min-w-0 truncate sm:inline">
          {realtimeLabel}
        </span>
      </span>
    </Button>
  )

  if (requiresUpgrade) {
    return (
      <>
        {trigger}
        <PaywallOverlay
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          restoreFocus={() => triggerRef.current?.focus({ preventScroll: true })}
        />
      </>
    )
  }

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      {tutorialCallout ? (
        <Tooltip open>
          <TooltipTrigger asChild>
            <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
          </TooltipTrigger>
          <WorkspaceTutorialCallout
            calloutId="workspace-board-team-access-header-action:callout"
            title={tutorialCallout.title}
            instruction={tutorialCallout.instruction}
            side="bottom"
            align="end"
            sideOffset={8}
            tooltipContentClassName={
              WORKSPACE_TUTORIAL_INVERSE_TOOLTIP_CLASSNAME
            }
          />
        </Tooltip>
      ) : (
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      )}

      <WorkspaceBoardTeamAccessHoverCard
        accessPeople={accessPeople}
        activeInviteRows={activeInviteRows}
        activeInviteCount={activeInviteCount}
        pendingTeamAccessCount={pendingTeamAccessCount}
        pendingTeamInvites={pendingTeamInvites}
        pendingAccessRequests={pendingAccessRequests}
        organizationAccessLoading={organizationAccessState.loading}
        organizationAccessLoadError={organizationAccessState.loadError}
        canInvite={canInvite}
        members={members}
        invites={invites}
        onInvitesChange={onInvitesChange}
        organizationAccessState={organizationAccessState}
      />
    </HoverCard>
  )
}

export function WorkspaceBoardTeamAccessHeaderAction(
  props: WorkspaceBoardTeamAccessHeaderActionProps
) {
  return (
    <>
      <HeaderActionsPortal slot="right">
        <WorkspaceBoardTeamAccessHeaderActionContent {...props} />
      </HeaderActionsPortal>
      <WorkspaceSidebarInviteBridge {...props} />
    </>
  )
}
