"use client"

import { useDocumentCapabilities } from "@/features/organization-document-collaboration/client"
import { Button } from "@/components/ui/button"
import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"
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
  const access = useDocumentCapabilities(sourceScope.organizationId)
  const canEditNative = canEdit && Boolean(access.capabilities?.canEdit)
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
      className="box-border flex h-full min-h-0 w-full min-w-0 flex-col gap-3 p-2 sm:py-3"
    >
      {access.capabilities?.reason === "upgrade" ? <FeatureUpgradeNotice title="Build your roadmap">Your saved roadmap stays readable. Upgrade to edit it in Coach House, or link Google Drive files from Documents.</FeatureUpgradeNotice> : null}
      {access.error ? <div role="alert" className="text-sm"><p>{access.error}</p><Button size="sm" variant="outline" onClick={access.retry}>Retry access check</Button></div> : null}
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
