"use client"

import { useMemo } from "react"

import type { OrgProgram } from "@/components/organization/org-profile-card/types"
import { locationSummary } from "@/components/organization/org-profile-card/utils"
import {
  resolveProgramBannerImageUrl,
  resolveProgramCardChips,
  resolveProgramProfileImageUrl,
  resolveProgramSummary,
} from "@/lib/programs/display"
import {
  buildWorkspaceActivityFeedFromCommunicationsOverlay,
  mergeWorkspaceActivityFeeds,
} from "../../../../_lib/workspace-activity"
import type {
  WorkspaceBoardState,
  WorkspaceSeedData,
} from "../../workspace-board-types"

export function useWorkspaceParticleSources(
  boardState: WorkspaceBoardState,
  programs: OrgProgram[],
  seed: WorkspaceSeedData
) {
  const organization = useMemo(
    () => ({
      id: seed.orgId,
      title: seed.organizationTitle,
      subtitle: seed.organizationSubtitle,
      logoUrl: seed.initialProfile.logoUrl,
      headerUrl: seed.initialProfile.headerUrl,
      programsCount: programs.length,
      peopleCount: seed.peopleCount,
      fundingGoalCents: seed.fundingGoalCents,
      raisedCents: seed.raisedCents,
    }),
    [
      seed.fundingGoalCents,
      seed.initialProfile.headerUrl,
      seed.initialProfile.logoUrl,
      seed.orgId,
      seed.organizationSubtitle,
      seed.organizationTitle,
      seed.peopleCount,
      seed.raisedCents,
      programs.length,
    ]
  )
  const activities = useMemo(
    () =>
      mergeWorkspaceActivityFeeds(
        seed.activityFeed,
        buildWorkspaceActivityFeedFromCommunicationsOverlay(
          boardState.communications.activityByDay
        )
      ),
    [boardState.communications.activityByDay, seed.activityFeed]
  )
  const particlePrograms = useMemo(
    () =>
      programs.map((program) => ({
        id: program.id,
        title: program.title?.trim() || "Untitled activity",
        location: locationSummary(program),
        description: resolveProgramSummary(program),
        bannerImageUrl: resolveProgramBannerImageUrl(program),
        imageUrl: resolveProgramProfileImageUrl(program),
        statusLabel: program.status_label?.trim() || "Draft",
        chips: resolveProgramCardChips(program),
        goalCents: program.goal_cents || 0,
        raisedCents: program.raised_cents || 0,
      })),
    [programs]
  )
  const calendarEvents = useMemo(
    () =>
      seed.calendar.upcomingEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.starts_at,
        allDay: event.all_day,
        assignedRoles: event.assigned_roles,
      })),
    [seed.calendar.upcomingEvents]
  )

  return {
    organization,
    activities,
    programs: particlePrograms,
    calendarEvents,
  }
}
