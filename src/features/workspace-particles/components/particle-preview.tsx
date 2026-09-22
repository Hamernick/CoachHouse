"use client"

import { useState } from "react"
import ActivityIcon from "lucide-react/dist/esm/icons/activity"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import TargetIcon from "lucide-react/dist/esm/icons/target"
import { DocumentThumbnail } from "@/components/organization/org-profile-card/tabs/documents-tab/components/document-thumbnail"
import {
  resolveDocumentsLibraryFileType,
  type LibraryItem,
} from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-items"
import { ProgramCard } from "@/components/programs/program-card"
import { ParticleCalendarPreview } from "./particle-calendar-preview"
import { ParticleNaturalPreview } from "./particle-natural-preview"
import {
  WorkspaceCardShell,
  WORKSPACE_CARD_CONTENT_SURFACE_CLASS_NAME,
} from "@/components/workspace/workspace-card-shell"
import { WorkspaceOrganizationOverviewSummary } from "@/components/workspace/workspace-organization-overview-summary"
import { cn } from "@/lib/utils"
import { particleImageUrl } from "../lib"
import type {
  ParticleDriveDocument,
  ParticleKind,
  ParticleSource,
} from "../types"

const IMAGE_OUTLINE_CLASS_NAME =
  "outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"

const compactDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

export function ParticleIcon({
  kind,
  className,
}: {
  kind: ParticleKind
  className?: string
}) {
  const Icon =
    kind === "organization"
      ? Building2Icon
      : kind === "activity"
        ? ActivityIcon
        : kind === "plan"
          ? TargetIcon
          : kind === "image"
            ? ImageIcon
            : kind === "drive"
              ? FileTextIcon
              : FileTextIcon
  return <Icon aria-hidden className={cn("size-5 shrink-0", className)} />
}

export function ParticleImageDisplay({
  source,
  className,
}: {
  source: ParticleSource
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!source.image || failed)
    return (
      <div className="text-muted-foreground grid h-full place-items-center p-3 text-center text-xs">
        Image unavailable
      </div>
    )
  // Private, authenticated endpoint; bypass the public Next image optimizer.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={particleImageUrl(source.image)}
      alt={source.title}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("size-full object-contain", className)}
    />
  )
}

function OrganizationPreview({ source }: { source: ParticleSource }) {
  const organization = source.organization
  if (!organization) return null
  return (
    <ParticleNaturalPreview width={552}>
      <WorkspaceCardShell className="h-auto p-3">
        <div className={WORKSPACE_CARD_CONTENT_SURFACE_CLASS_NAME}>
          <WorkspaceOrganizationOverviewSummary
            fundingGoalCents={organization.fundingGoalCents}
            headerUrl={organization.headerUrl ?? ""}
            logoUrl={organization.logoUrl ?? ""}
            peopleCount={organization.peopleCount}
            programsCount={organization.programsCount}
            subtitle={organization.subtitle}
            title={organization.title}
          />
        </div>
      </WorkspaceCardShell>
    </ParticleNaturalPreview>
  )
}

function ActivityPreview({ source }: { source: ParticleSource }) {
  const program = source.programs?.[0]
  if (program)
    return (
      <WorkspaceCardShell className="h-auto p-3">
        <ProgramCard
          title={program.title}
          location={program.location ?? undefined}
          description={program.description ?? undefined}
          bannerImageUrl={program.bannerImageUrl ?? undefined}
          imageUrl={program.imageUrl ?? undefined}
          statusLabel={program.statusLabel ?? undefined}
          showStatusBadge={false}
          chips={program.chips}
          goalCents={program.goalCents}
          raisedCents={program.raisedCents}
          ctaLabel="Open"
          variant="medium"
          contentFill={false}
          className="border-border/60 bg-background/35 h-auto min-h-0 max-w-none border shadow-none"
        />
      </WorkspaceCardShell>
    )
  const activities = source.activities ?? []
  const latest = activities[0]
  const date = latest ? new Date(latest.timestamp) : null
  return (
    <div className="flex size-full flex-col gap-2 p-2.5">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary grid size-7 place-items-center rounded-[8px]">
          <ActivityIcon className="size-3.5" />
        </div>
        <p className="text-muted-foreground text-[10px] tabular-nums">
          {activities.length} recent records
        </p>
      </div>
      {latest ? (
        <div className="bg-background/80 min-h-0 flex-1 rounded-[8px] px-2.5 py-2 outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10">
          <p className="line-clamp-2 text-xs leading-4 font-medium">
            {latest.title}
          </p>
          <p className="text-muted-foreground mt-1 text-[10px]">
            {date && Number.isFinite(date.getTime())
              ? compactDate.format(date)
              : "Date unavailable"}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground my-auto text-xs">
          Activity will appear here.
        </p>
      )}
    </div>
  )
}

function RoadmapPreview() {
  return (
    <div className="text-muted-foreground grid h-16 w-full place-items-center">
      <FileTextIcon aria-hidden className="size-8 stroke-[1.5]" />
    </div>
  )
}

function ObjectivePreview({ source }: { source: ParticleSource }) {
  const steps = source.plan?.steps ?? []
  const completed = steps.filter((step) => step.complete).length
  const progress = steps.length
    ? Math.round((completed / steps.length) * 100)
    : 0
  return (
    <div className="flex size-full flex-col p-2.5">
      <div className="flex items-start gap-2">
        <TargetIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="line-clamp-2 text-xs leading-4 font-medium">
          {source.plan?.title ?? source.title}
        </p>
      </div>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-[10px] leading-4">
        {source.plan?.summary || source.description}
      </p>
      <div className="mt-auto space-y-1.5">
        <div className="bg-muted h-1 overflow-hidden rounded-full">
          <div
            className="bg-foreground h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-muted-foreground text-[10px] tabular-nums">
          {completed} of {steps.length} steps
        </p>
      </div>
    </div>
  )
}

export function buildDrivePreviewItem(
  document: ParticleDriveDocument
): LibraryItem {
  return {
    id: `drive:${document.id}`,
    name: document.name,
    description: "Google Drive",
    source: "uploaded",
    fileType: resolveDocumentsLibraryFileType(document.mimeType, document.name),
    updatedAt: document.modifiedAt ?? null,
    deleted: document.status === "trashed",
    href: document.webViewLink ?? undefined,
    previewPath: `/api/integrations/google-drive/documents/${encodeURIComponent(document.id)}/preview`,
    previewVersion: document.modifiedAt ?? undefined,
    driveDocument: {
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      webViewLink: document.webViewLink ?? "",
      modifiedAt: document.modifiedAt ?? null,
      status: document.status,
    },
  }
}

function driveUnavailableLabel(status: ParticleDriveDocument["status"]) {
  if (status === "needs_reconnect") return "Reconnect Google Drive"
  if (status === "inaccessible") return "Access unavailable"
  if (status === "trashed") return "File moved to trash"
  return null
}

function DrivePreview({ source }: { source: ParticleSource }) {
  const document = source.document
  if (!document) return null
  const unavailableLabel = driveUnavailableLabel(document.status)
  if (!unavailableLabel)
    return (
      <div
        className="size-full min-h-0 overflow-hidden"
        aria-label={`${source.title} Google Drive preview`}
      >
        <DocumentThumbnail
          item={buildDrivePreviewItem(document)}
          compact={false}
        />
      </div>
    )
  return (
    <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-2.5 text-center">
      <div className="grid size-8 place-items-center rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <FileTextIcon className="size-4" />
      </div>
      <p className="text-[10px] leading-3">{unavailableLabel}</p>
    </div>
  )
}

export function ParticlePreview({ source }: { source: ParticleSource }) {
  if (source.ref.kind === "image")
    return (
      <ParticleImageDisplay
        source={source}
        className={cn("rounded-[10px] object-cover", IMAGE_OUTLINE_CLASS_NAME)}
      />
    )
  if (source.organization) return <OrganizationPreview source={source} />
  if (source.activities) return <ActivityPreview source={source} />
  if (source.ref.kind === "roadmap" && source.ref.id === "board_calendar")
    return <ParticleCalendarPreview />
  if (source.ref.kind === "roadmap") return <RoadmapPreview />
  if (source.plan) return <ObjectivePreview source={source} />
  if (source.document) return <DrivePreview source={source} />
  return (
    <div className="text-muted-foreground grid size-full place-items-center">
      <ParticleIcon kind={source.ref.kind} className="size-6" />
    </div>
  )
}
