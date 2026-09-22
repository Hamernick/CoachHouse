"use client"

import { CoachingAvatarGroup, type CoachingAvatar } from "@/components/coaching/coaching-avatar-group"

import type { ReactNode } from "react"

import {
  ArrowsClockwise,
  Briefcase,
  Flag,
  Globe,
  PencilSimpleLine,
  Star,
  Tag,
  Timer,
  User,
} from "@phosphor-icons/react/dist/ssr"

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
  MEMBER_WORKSPACE_PROJECT_PRIORITY_OPTIONS,
  MEMBER_WORKSPACE_PROJECT_STATUS_OPTIONS,
  type MemberWorkspaceProjectDetailDraft,
} from "./member-workspace-project-detail-editing"
import {
  DateChip,
  HeaderMetaChip,
  MembersAssignmentMenu,
  SelectChip,
  headerChipIconClassName,
  parseHeaderChipList,
} from "./member-workspace-project-detail-header-controls"
import type { MemberWorkspacePersonOption } from "../../types"

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
}: {
  ariaLabel: string
  className?: string
  id: string
  inputClassName?: string
  placeholder?: string
  previewClassName?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Editable
      id={id}
      value={value}
      placeholder={placeholder}
      triggerMode="click"
      className={cn("min-w-0 gap-0", className)}
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
  const statusLabel =
    isEditing && draft
      ? formatStatusLabel(draft.status)
      : formatBacklogStatusLabel(project.backlog.statusLabel)
  const coaches = assignedCoaches ?? assignedCoachNames?.map((name) => ({ id: name, name, imageUrl: null }))
  const metaItems = [
    {
      label: "Coach",
      value: coaches == null ? "Unavailable" : coaches.length ? (
        <span className="inline-flex min-w-0 items-center gap-2">
          <CoachingAvatarGroup avatars={coaches} size="xs" limit={3} showOverflow label="Assigned coaches" />
          <span className="max-w-48 truncate" title={coaches.map((coach) => coach.name).join(", ")}>
            {coaches.map((coach) => coach.name).join(", ")}
          </span>
        </span>
      ) : "Unassigned",
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
    {
      label: "Last sync",
      value: project.meta.lastSyncLabel,
      icon: <ArrowsClockwise className="h-4 w-4" />,
    },
  ].filter(
    (item) =>
      item.value !== undefined && item.value !== null && item.value !== ""
  )

  return (
    <section className="mt-4 flex flex-col gap-5 lg:gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {isEditing && draft && onChangeDraftField ? (
              <InlineEditableText
                id="member-workspace-project-name"
                ariaLabel="Project name"
                value={draft.name}
                placeholder="Untitled organization..."
                onChange={(value) => onChangeDraftField("name", value)}
                previewClassName="text-foreground max-w-[min(44rem,100%)] truncate text-2xl leading-tight font-semibold"
                inputClassName="text-foreground h-auto min-w-[18rem] max-w-full text-2xl leading-tight font-semibold"
              />
            ) : (
              <h1 className="text-foreground text-2xl leading-tight font-semibold">
                {project.name}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {isEditing && draft && onChangeDraftField ? (
                <SelectChip
                  id="member-workspace-project-status"
                  label="Project status"
                  value={draft.status}
                  leadingIcon={
                    <Star className={headerChipIconClassName} aria-hidden />
                  }
                  options={MEMBER_WORKSPACE_PROJECT_STATUS_OPTIONS}
                  triggerClassName={statusBadgeClasses(statusLabel)}
                  onChange={(value) => onChangeDraftField("status", value)}
                />
              ) : (
                <Badge
                  variant="secondary"
                  className={statusBadgeClasses(statusLabel)}
                >
                  <Star className="h-3 w-3" />
                  {statusLabel}
                </Badge>
              )}
              {project.backlog.picUsers.length > 0 ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 border-none bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100"
                >
                  <User className="h-3 w-3" />
                  Assigned
                </Badge>
              ) : null}
            </div>
          </div>

          {isEditing && draft && onChangeDraftField ? (
            <div className="flex max-w-5xl flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground flex items-center gap-2">
                  <span>ID:</span>
                  <span className="text-foreground font-medium">
                    #{project.id}
                  </span>
                </div>
              </div>
              <SelectChip
                id="member-workspace-project-priority"
                label="Project priority"
                value={draft.priority}
                options={MEMBER_WORKSPACE_PROJECT_PRIORITY_OPTIONS}
                leadingIcon={
                  <Flag className={headerChipIconClassName} aria-hidden />
                }
                onChange={(value) => onChangeDraftField("priority", value)}
              />
              {draft.clientName ? (
                <HeaderMetaChip
                  icon={
                    <Briefcase
                      className={headerChipIconClassName}
                      aria-hidden
                    />
                  }
                >
                  {draft.clientName}
                </HeaderMetaChip>
              ) : null}
              <DateChip
                id="member-workspace-project-start-date"
                label="Start"
                value={draft.startDate}
                onChange={(value) => onChangeDraftField("startDate", value)}
              />
              <DateChip
                id="member-workspace-project-end-date"
                label="End"
                value={draft.endDate}
                onChange={(value) => onChangeDraftField("endDate", value)}
              />
              {draft.typeLabel ? (
                <HeaderMetaChip
                  icon={
                    <Timer className={headerChipIconClassName} aria-hidden />
                  }
                >
                  {draft.typeLabel}
                </HeaderMetaChip>
              ) : null}
              {draft.durationLabel ? (
                <HeaderMetaChip>{draft.durationLabel}</HeaderMetaChip>
              ) : null}
              {parseHeaderChipList(draft.tags).map((tag) => (
                <HeaderMetaChip
                  key={tag}
                  icon={<Tag className={headerChipIconClassName} aria-hidden />}
                >
                  {tag}
                </HeaderMetaChip>
              ))}
              <MembersAssignmentMenu
                id="member-workspace-project-members"
                assigneeOptions={assigneeOptions}
                value={draft.memberLabels}
                onChange={(value) => onChangeDraftField("memberLabels", value)}
              />
              {project.meta.locationLabel ? (
                <HeaderMetaChip
                  icon={
                    <Globe className={headerChipIconClassName} aria-hidden />
                  }
                >
                  {project.meta.locationLabel}
                </HeaderMetaChip>
              ) : null}
              <HeaderMetaChip
                icon={
                  <ArrowsClockwise
                    className={headerChipIconClassName}
                    aria-hidden
                  />
                }
              >
                {project.meta.lastSyncLabel}
              </HeaderMetaChip>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
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

      {!isEditing ? (
        <div className="mt-3 lg:mt-0">
          <MetaChipsRow items={metaItems} />
        </div>
      ) : null}
    </section>
  )
}
