"use client"

import { CoachingAvatarGroup, type CoachingAvatar } from "@/components/coaching/coaching-avatar-group"

import type { ReactNode } from "react"

import {
  Folder,
  Globe,
  PencilSimpleLine,
  Star,
  Timer,
  User,
} from "@phosphor-icons/react/dist/ssr"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { resolveOrganizationCardImage } from "../../lib/organization-card-image"
import { Button } from "@/components/ui/button"
import {
  Editable,
  EditableArea,
  EditableInput,
  EditablePreview,
} from "@/components/ui/editable"
import {
  Badge,
  MetaChipsRow,
  PriorityBadge,
  type ProjectDetails,
  type PriorityLevel,
} from "@/features/platform-admin-dashboard"
import { cn } from "@/lib/utils"
import {
  MEMBER_WORKSPACE_PROJECT_STATUS_OPTIONS,
  MEMBER_WORKSPACE_STANDARD_PROJECT_STATUS_OPTIONS,
  type MemberWorkspaceProjectDetailDraft,
} from "./member-workspace-project-detail-editing"
import {
  HeaderMetaChip,
  MembersAssignmentMenu,
  SelectChip,
  headerChipIconClassName,
  headerChipClassName,
} from "./member-workspace-project-detail-header-controls"
import { ProjectDetailHeaderFields } from "./member-workspace-project-detail-header-fields"
import type { MemberWorkspacePersonOption, MemberWorkspaceAdminOrganizationSummary } from "../../types"

function statusBadgeClasses(status: string) {
  switch (status) {
    case "Active":
      return "bg-blue-100 text-blue-700 border-none dark:bg-blue-500/15 dark:text-blue-50"
    case "Onboarding":
      return "bg-orange-100 text-orange-700 border-none dark:bg-orange-500/15 dark:text-orange-100"
    case "Archived":
      return "bg-zinc-100 text-zinc-700 border-none dark:bg-zinc-600/20 dark:text-zinc-100"
    default:
      return "bg-muted text-muted-foreground border-none"
  }
}

function formatStatusLabel(
  status: MemberWorkspaceProjectDetailDraft["status"]
) {
  switch (status) {
    case "active":
      return "Active"
    case "completed":
    case "cancelled":
      return "Archived"
    default:
      return "Onboarding"
  }
}

function formatBacklogStatusLabel(
  status: ProjectDetails["backlog"]["statusLabel"]
) {
  if (status === "Active") return "Active"
  if (status === "Completed" || status === "Cancelled") return "Archived"
  return "Onboarding"
}

type MemberWorkspaceProjectDetailHeaderProps = {
  organizationSummary?: MemberWorkspaceAdminOrganizationSummary
  coachControl?: ReactNode
  assignedCoaches?: CoachingAvatar[] | null
  assignedCoachNames?: string[] | null
  project: ProjectDetails
  canEditProject?: boolean
  isEditing?: boolean
  draft?: MemberWorkspaceProjectDetailDraft
  assigneeOptions?: MemberWorkspacePersonOption[]
  onChangeDraftField?: (
    field: keyof MemberWorkspaceProjectDetailDraft,
    value: string
  ) => void
  onEditProject?: () => void
  actions?: ReactNode
}

function InlineEditableText({
  ariaLabel,
  className,
  id,
  inputClassName,
  placeholder,
  previewClassName,
  value,
  onChange,
  onBeginEdit,
}: {
  ariaLabel: string
  className?: string
  id: string
  inputClassName?: string
  placeholder?: string
  previewClassName?: string
  value: string
  onChange: (value: string) => void
  onBeginEdit?: () => void
}) {
  return (
    <Editable
      id={id}
      value={value}
      placeholder={placeholder}
      triggerMode="click"
      className={cn("min-w-0 gap-0", className)}
      onEdit={onBeginEdit}
      onValueChange={onChange}
      onSubmit={(nextValue) => onChange(nextValue.trim())}
    >
      <EditableArea className="min-w-0">
        <EditablePreview
          aria-label={ariaLabel}
          className={cn(
            "border-border/0 min-w-0 px-0 py-0 focus-visible:ring-2",
            previewClassName
          )}
        />
        <EditableInput
          aria-label={ariaLabel}
          className={cn(
            "border-border/60 bg-background/90 px-2 py-1",
            inputClassName
          )}
        />
      </EditableArea>
    </Editable>
  )
}

export function MemberWorkspaceProjectDetailHeader({
  organizationSummary,
  coachControl,
  assignedCoachNames,
  assignedCoaches,
  project,
  assigneeOptions = [],
  canEditProject = false,
  isEditing = false,
  draft,
  onChangeDraftField,
  onEditProject,
  actions,
}: MemberWorkspaceProjectDetailHeaderProps) {
  const isOrganization = Boolean(organizationSummary)
  const canEditFields = canEditProject && Boolean(draft && onChangeDraftField)
  const beginEdit = () => { if (!isEditing) onEditProject?.() }
  const organizationImage = organizationSummary ? resolveOrganizationCardImage(organizationSummary) : null
  const statusOptions = project.source && "projectKind" in project.source && project.source.projectKind === "standard" ? MEMBER_WORKSPACE_STANDARD_PROJECT_STATUS_OPTIONS : MEMBER_WORKSPACE_PROJECT_STATUS_OPTIONS
  const isFiscalSponsorship = project.source?.fiscalSponsorshipEnabled === true
  const statusLabel =
    canEditFields && draft
      ? statusOptions.find((option) => option.value === draft.status)?.label ?? formatStatusLabel(draft.status)
      : formatBacklogStatusLabel(project.backlog.statusLabel)
  const coaches = assignedCoaches ?? assignedCoachNames?.map((name) => ({ id: name, name, imageUrl: null }))
  const metaItems = [
    {
      label: "Coach",
      value: coachControl ?? (coaches == null ? "Unavailable" : coaches.length ? (
        <span className="inline-flex min-w-0 items-center gap-2">
          <CoachingAvatarGroup avatars={coaches} size="xs" limit={3} showOverflow label="Assigned coaches" />
          <span className="max-w-48 truncate" title={coaches.map((coach) => coach.name).join(", ")}>
            {coaches.map((coach) => coach.name).join(", ")}
          </span>
        </span>
      ) : "Unassigned"),
      icon: null,
    },
    { label: "ID", value: `#${project.id}`, icon: null },
    {
      label: "",
      value: (
        <PriorityBadge
          level={project.meta.priorityLabel.toLowerCase() as PriorityLevel}
          appearance="inline"
          size="sm"
        />
      ),
      icon: null,
    },
    {
      label: "",
      value: project.meta.locationLabel,
      icon: <Globe className="h-4 w-4" />,
    },
    {
      label: "Sprints",
      value: project.meta.sprintLabel,
      icon: <Timer className="h-4 w-4" />,
    },

  ].filter(
    (item) =>
      item.value !== undefined && item.value !== null && item.value !== ""
  )

  return (
    <section {...getReactGrabOwnerProps({ ownerId: `project-detail-header:${project.id}`, component: "MemberWorkspaceProjectDetailHeader", source: "src/features/member-workspace/components/projects/member-workspace-project-detail-header.tsx", tokenSource: "src/app/globals.css" })}
      className={cn("mt-4 flex flex-col gap-5 lg:gap-2", isOrganization && "items-center text-center")}>
      <div className={cn("flex flex-wrap items-start justify-between gap-3", isOrganization && "relative w-full justify-center")}>
        <div className={cn("flex min-w-0 flex-1 flex-col gap-3", isOrganization && "items-center px-10")}>
          {isOrganization ? (
            <Avatar className="size-20 rounded-xl border border-gray-200 bg-white">
              {organizationImage ? <AvatarImage src={organizationImage} alt={`${project.name} organization profile`} className="rounded-xl object-contain p-1" /> : null}
              <AvatarFallback className="rounded-xl bg-transparent"><Folder className="text-muted-foreground size-9" aria-hidden /></AvatarFallback>
            </Avatar>
          ) : null}
          <div className={cn("flex w-full min-w-0 flex-col items-start gap-3", isOrganization && "items-center")}>
            {canEditFields && draft && onChangeDraftField ? (
              <InlineEditableText
                className={cn("w-full min-w-0", isOrganization && "max-w-xl")}
                id="member-workspace-project-name"
                ariaLabel="Project name"
                value={draft.name}
                placeholder="Untitled organization..."
                onBeginEdit={beginEdit}
                onChange={(value) => onChangeDraftField("name", value)}
                previewClassName="text-foreground w-full max-w-full whitespace-normal break-words overflow-visible text-3xl leading-tight font-semibold sm:text-4xl md:text-4xl"
                inputClassName={cn("text-foreground h-auto w-full min-w-0 max-w-full text-3xl leading-tight font-semibold sm:text-4xl md:text-4xl", isOrganization && "text-center")}
              />
            ) : (
              <h1 className="text-foreground max-w-full break-words text-3xl leading-tight font-semibold sm:text-4xl">
                {project.name}
              </h1>
            )}
            <div className={cn("flex flex-wrap items-center gap-2", isOrganization && "justify-center")}>
              {isFiscalSponsorship && !(isEditing && canEditFields) ? (
                <Badge variant="secondary" className={cn(headerChipClassName, statusBadgeClasses("Fiscal Sponsorship"))}>
                  <Star className="h-3 w-3" aria-hidden />
                  Fiscal Sponsorship
                </Badge>
              ) : canEditFields && draft && onChangeDraftField ? (
                <SelectChip
                  id="member-workspace-project-status"
                  label="Project status"
                  value={draft.status}
                  leadingIcon={
                    <Star className={headerChipIconClassName} aria-hidden />
                  }
                  options={statusOptions}
                  triggerClassName={statusBadgeClasses(statusLabel)}
                  onBeginEdit={beginEdit}
                  onChange={(value) => onChangeDraftField("status", value)}
                />
              ) : (
                <Badge
                  variant="secondary"
                  className={cn(headerChipClassName, statusBadgeClasses(statusLabel))}
                >
                  <Star className="h-3 w-3" />
                  {statusLabel}
                </Badge>
              )}
              {canEditFields && draft && onChangeDraftField ? (
                <MembersAssignmentMenu id="member-workspace-project-members" assigneeOptions={assigneeOptions}
                  value={draft.memberLabels} onBeginEdit={beginEdit}
                  onChange={(value) => onChangeDraftField("memberLabels", value)} />
              ) : project.backlog.picUsers.length > 0 ? (
                <Badge
                  variant="outline"
                  className="flex h-7 items-center gap-1 border-none bg-orange-100 px-3 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100"
                >
                  <User className="h-3 w-3" />
                  Assigned
                </Badge>
              ) : null}
            </div>
          </div>

          {canEditFields && draft && onChangeDraftField ? (
            <ProjectDetailHeaderFields project={project} draft={draft} isOrganization={isOrganization}
              onChange={onChangeDraftField} onBeginEdit={beginEdit}
              coach={isOrganization ? coachControl ?? <HeaderMetaChip>Coach: {metaItems[0].value}</HeaderMetaChip> : null} />
          ) : null}
        </div>

        <div className={cn("flex items-center gap-2", isOrganization && "absolute right-0 top-0")}>
          {actions}
          {canEditProject && !isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit project"
              className="text-muted-foreground hover:text-foreground size-9 rounded-lg"
              onClick={onEditProject}
            >
              <PencilSimpleLine className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {!canEditFields ? (
        <div className="mt-3 lg:mt-0">
          <MetaChipsRow items={isOrganization ? metaItems : metaItems.filter((item) => item.label !== "Coach")} className={cn("[&>div]:min-h-7", isOrganization && "justify-center")} />
        </div>
      ) : null}
    </section>
  )
}
