"use client"

import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import ChevronUpIcon from "lucide-react/dist/esm/icons/chevron-up"
import Clock4Icon from "lucide-react/dist/esm/icons/clock-4"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import XIcon from "lucide-react/dist/esm/icons/x"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  clampDurationValue,
  formatDuration,
  formatRemaining,
  formatTimestamp,
  isWorkspaceInviteAccessAvailable,
  resolveWorkspaceInviteAccessCopy,
  statusLabel,
  statusTone,
  type WorkspaceInviteAccessLevel,
  type WorkspaceInviteAudience,
} from "./workspace-board-invite-sheet-helpers"
import {
  type InviteRow,
  useWorkspaceInviteTargets,
  WorkspaceTemporaryInvitePicker,
} from "./workspace-board-invite-sheet-content-support"
import { WorkspaceBoardInviteSheetTeamSection } from "./workspace-board-invite-sheet-team-section"
import type { WorkspaceBoardOrganizationAccessSnapshot } from "./workspace-board-organization-access-state"
import type {
  WorkspaceCollaborationInviteStatus,
  WorkspaceDurationUnit,
  WorkspaceMemberOption,
} from "./workspace-board-types"
import type { WorkspaceBoardAccessManagementActions } from "./use-workspace-board-access-management-actions"

export function WorkspaceBoardInviteSheetBody({
  canInviteTemporary,
  isPending,
  organizationAccessState,
  accessManagementActions,
  inviteUrlBase,
  memberOptions,
  inviteAudience,
  onInviteAudienceChange,
  inviteAccessLevel,
  onInviteAccessLevelChange,
  selectedMemberId,
  onSelectedMemberIdChange,
  teamInviteEmail,
  onTeamInviteEmailChange,
  durationValue,
  onDurationValueChange,
  durationUnit,
  onDurationUnitChange,
  onCreate,
  onCreateTeamInvite,
  activeInvites,
  historicalInvites,
  onRevoke,
  onCopyOrganizationInviteLink,
  onRevokeOrganizationInvite,
  onRevokeOrganizationAccessRequest,
}: {
  canInviteTemporary: boolean
  isPending: boolean
  organizationAccessState: WorkspaceBoardOrganizationAccessSnapshot
  accessManagementActions: WorkspaceBoardAccessManagementActions
  inviteUrlBase: string
  memberOptions: WorkspaceMemberOption[]
  inviteAudience: WorkspaceInviteAudience
  onInviteAudienceChange: (value: WorkspaceInviteAudience) => void
  inviteAccessLevel: WorkspaceInviteAccessLevel
  onInviteAccessLevelChange: (value: WorkspaceInviteAccessLevel) => void
  selectedMemberId: string
  onSelectedMemberIdChange: (value: string) => void
  teamInviteEmail: string
  onTeamInviteEmailChange: (value: string) => void
  durationValue: number
  onDurationValueChange: (value: number) => void
  durationUnit: WorkspaceDurationUnit
  onDurationUnitChange: (value: WorkspaceDurationUnit) => void
  onCreate: () => void
  onCreateTeamInvite: () => void
  activeInvites: InviteRow[]
  historicalInvites: InviteRow[]
  onRevoke: (inviteId: string) => void
  onCopyOrganizationInviteLink: (link: string) => void
  onRevokeOrganizationInvite: (inviteId: string) => void
  onRevokeOrganizationAccessRequest: (requestId: string) => void
}) {
  const {
    coachTargets,
    memberTargets,
    normalizedSelectedMemberId,
    selectedMember,
  } = useWorkspaceInviteTargets(memberOptions, selectedMemberId)
  const accessCopy = resolveWorkspaceInviteAccessCopy(
    inviteAudience,
    inviteAccessLevel
  )
  const accessAvailable = isWorkspaceInviteAccessAvailable(
    inviteAudience,
    inviteAccessLevel
  )
  const isTeamInvite = inviteAudience === "team"

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
      {!organizationAccessState.loading && !organizationAccessState.hasPaidTeamAccess ? (
        <FeatureUpgradeNotice title="Bring your team into the workspace">
          Upgrade to invite teammates, assign roles, and give collaborators temporary access. Free is your personal organization workspace.
        </FeatureUpgradeNotice>
      ) : null}
      <section className="border-border/60 bg-background/30 space-y-3 rounded-lg border p-3">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Invite type
          </p>
          <Tabs
            value={inviteAudience}
            onValueChange={(value) =>
              onInviteAudienceChange(value as WorkspaceInviteAudience)
            }
            className="gap-0"
          >
            <TabsList className="border-border/60 bg-background/70 w-fit max-w-full gap-1 self-start rounded-full border p-1">
              <TabsTrigger
                value="team"
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-full px-3 py-1.5 text-xs"
              >
                Team
              </TabsTrigger>
              <TabsTrigger
                value="temporary"
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-full px-3 py-1.5 text-xs"
              >
                Temporary
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="workspace-invite-access"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Access
          </Label>
          <Select
            value={inviteAccessLevel}
            onValueChange={(value) =>
              onInviteAccessLevelChange(value as WorkspaceInviteAccessLevel)
            }
          >
            <SelectTrigger
              id="workspace-invite-access"
              className="bg-background/70 w-full sm:w-[180px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <div className="border-border/60 bg-background/60 rounded-md border px-3 py-2">
            <p className="text-foreground text-sm font-medium">
              {accessCopy.title}
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {accessCopy.description}
            </p>
          </div>
        </div>

        {isTeamInvite ? (
          <WorkspaceBoardInviteSheetTeamSection
            isPending={isPending}
            organizationAccessState={organizationAccessState}
            accessManagementActions={accessManagementActions}
            inviteUrlBase={inviteUrlBase}
            inviteAccessLevel={inviteAccessLevel}
            teamInviteEmail={teamInviteEmail}
            onTeamInviteEmailChange={onTeamInviteEmailChange}
            onCreateTeamInvite={onCreateTeamInvite}
            onCopyOrganizationInviteLink={onCopyOrganizationInviteLink}
            onRevokeOrganizationInvite={onRevokeOrganizationInvite}
            onRevokeOrganizationAccessRequest={
              onRevokeOrganizationAccessRequest
            }
          />
        ) : accessAvailable ? (
          <>
            <WorkspaceTemporaryInvitePicker
              coachTargets={coachTargets}
              memberTargets={memberTargets}
              selectedTargetId={normalizedSelectedMemberId}
              selectedTarget={selectedMember}
              onSelectedTargetChange={onSelectedMemberIdChange}
            />

            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="workspace-invite-duration">Duration</Label>
                <div
                  id="workspace-invite-duration"
                  className="border-border/60 bg-background/70 grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1 rounded-md border p-1"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      onDurationValueChange(
                        clampDurationValue(durationValue - 1)
                      )
                    }
                    disabled={!canInviteTemporary}
                    aria-label="Decrease invite duration"
                  >
                    <ChevronDownIcon className="h-4 w-4" aria-hidden />
                  </Button>
                  <div className="flex min-w-0 flex-col items-center justify-center">
                    <span className="text-2xl leading-none font-semibold tabular-nums">
                      {durationValue}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      onDurationValueChange(
                        clampDurationValue(durationValue + 1)
                      )
                    }
                    disabled={!canInviteTemporary}
                    aria-label="Increase invite duration"
                  >
                    <ChevronUpIcon className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workspace-invite-unit">Unit</Label>
                <Select
                  value={durationUnit}
                  onValueChange={(value) =>
                    onDurationUnitChange(value as WorkspaceDurationUnit)
                  }
                >
                  <SelectTrigger id="workspace-invite-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              className="h-9 w-full"
              onClick={onCreate}
              disabled={isPending || !canInviteTemporary || !selectedMemberId}
            >
              {isPending ? (
                <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Create temporary invite
            </Button>
          </>
        ) : (
          <div className="border-border/60 bg-background/40 text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm">
            Temporary viewer access is not available yet. Use the Team tab for
            read-only invites, or switch to Editor for timed collaboration.
          </div>
        )}
      </section>

      {!isTeamInvite ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Active invites</h3>
          {activeInvites.length === 0 ? (
            <p className="border-border/60 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
              No active invites.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeInvites.map(({ invite, status }) => (
                <li
                  key={invite.id}
                  className="border-border/60 bg-background/30 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {invite.userName?.trim() ||
                          invite.userEmail ||
                          invite.userId}
                      </p>
                      <Badge variant="outline" className={statusTone(status)}>
                        {statusLabel(status)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                      <Clock4Icon className="h-3 w-3" aria-hidden />
                      {formatDuration(
                        invite.durationValue,
                        invite.durationUnit
                      )}{" "}
                      · {formatRemaining(invite.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onRevoke(invite.id)}
                    disabled={isPending || !canInviteTemporary}
                    aria-label="Revoke invite"
                  >
                    <XIcon className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!isTeamInvite ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Invite history</h3>
          {historicalInvites.length === 0 ? (
            <p className="border-border/60 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
              No recent expired or revoked invites.
            </p>
          ) : (
            <ul className="space-y-2">
              {historicalInvites.map(({ invite, status }) => (
                <li
                  key={invite.id}
                  className="border-border/60 bg-background/20 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {invite.userName?.trim() ||
                        invite.userEmail ||
                        invite.userId}
                    </p>
                    <Badge variant="outline" className={statusTone(status)}>
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDuration(invite.durationValue, invite.durationUnit)}{" "}
                    ·{" "}
                    {status === "revoked"
                      ? `Revoked ${formatTimestamp(invite.revokedAt)}`
                      : `Expired ${formatTimestamp(invite.expiresAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
