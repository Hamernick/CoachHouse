"use client"

import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"
import { useWorkspaceBoardOrganizationAccessState } from "../../workspace-board-organization-access-state"
import { RoadmapEditor } from "@/components/roadmap/roadmap-editor"
import type { RoadmapSection } from "@/lib/roadmap"

import type { WorkspaceDataDrawerRequest } from "./workspace-canvas-overlay-drawer-tabs"

export function WorkspaceCanvasOverlayRoadmapPanel({
  sourceScope,
  sections,
  publicSlug,
  canEdit,
  request,
}: {
  sourceScope: import("@/components/roadmap/core-document-source/use-core-document-source").CoreDocumentScope
  sections: RoadmapSection[]
  publicSlug: string | null
  canEdit: boolean
  request: WorkspaceDataDrawerRequest | null
}) {
  const access = useWorkspaceBoardOrganizationAccessState({ enabled: true })
  const canEditNative = canEdit && access.hasPaidTeamAccess
  const requestedSectionSlug =
    request?.tab === "roadmap" ? request.roadmapSectionSlug : null
  const initialSectionId =
    sections.find(
      (section) =>
        section.slug === requestedSectionSlug ||
        section.id === requestedSectionSlug
    )?.id ?? null

  return (
    <div
      data-workspace-roadmap-drawer-panel="true"
      data-workspace-roadmap-section={requestedSectionSlug ?? undefined}
      className="box-border flex h-full min-h-0 w-full min-w-0 flex-col gap-3 p-2 sm:p-3"
    >
      {!access.loading && !access.hasPaidTeamAccess ? <FeatureUpgradeNotice title="Build your roadmap">Your saved roadmap stays readable. Upgrade to edit it in Coach House, or link Google Drive files from Documents.</FeatureUpgradeNotice> : null}
      <RoadmapEditor
        sourceScope={sourceScope}
        sections={sections}
        publicSlug={publicSlug}
        canEdit={canEditNative}
        navigationMode="embedded"
        showRightRail={false}
        initialSectionId={initialSectionId}
      />
    </div>
  )
}
