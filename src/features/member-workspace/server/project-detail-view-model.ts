import { differenceInCalendarDays, format } from "date-fns"
import { getProjectSchedule } from "../lib/project-schedule"

import type {
  BacklogSummary,
  KeyFeatures,
  NoteStatus,
  NoteType,
  ProjectDetails,
  ProjectActivityItem,
  ProjectFile,
  ProjectMeta,
  ProjectNote,
  ProjectScope,
  QuickLink,
  TimeSummary,
  TimelineTask,
  User,
  WorkstreamGroup,
  WorkstreamTask,
} from "@/features/platform-admin-dashboard"
import type { Database } from "@/lib/supabase"
import { buildProjectAssetOpenPath } from "../lib/project-assets"
import {
  mapOrganizationProjectToViewModel,
  type OrganizationProjectRecord,
} from "./project-starter-data"
import type { MemberWorkspacePersonOption } from "../types"
import { buildMemberWorkspaceProjectOverviewContent } from "./project-overview-content"
import type { MemberWorkspaceProjectOverviewDocumentRecord } from "./project-overview-documents"

export type MemberWorkspaceProjectTaskRecord = Pick<
  Database["public"]["Tables"]["organization_tasks"]["Row"],
  | "id"
  | "project_id"
  | "title"
  | "description"
  | "task_type"
  | "status"
  | "start_date"
  | "end_date"
  | "priority"
  | "tag_label"
  | "workstream_name"
  | "sort_order"
> & {
  assignee_id?: string | null
  assignee_name?: string | null
  assignee_avatar_url?: string | null
}

export type MemberWorkspaceProjectNoteRecord = {
  id: string
  title: string
  content: string | null
  note_type: string
  status: string
  created_at: string
  created_by: string
  created_by_name: string | null
  created_by_avatar_url: string | null
}

export type MemberWorkspaceProjectQuickLinkRecord = {
  id: string
  name: string
  url: string
  link_type: string
  size_mb: number
}

export type MemberWorkspaceProjectAssetRecord = {
  id: string
  project_id: string
  name: string
  description: string | null
  asset_type: string
  external_url: string | null
  size_bytes: number | null
  created_at: string
  created_by: string
  created_by_name: string | null
  created_by_avatar_url: string | null
}

function parseDateOnly(input: string) {
  return new Date(`${input}T00:00:00.000Z`)
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function buildUsers(
  memberLabels: string[],
  assigneeOptions: MemberWorkspacePersonOption[]
): User[] {
  const assigneeOptionsByName = new Map(
    assigneeOptions.map(
      (option) => [normalizeName(option.name), option] as const
    )
  )

  return memberLabels.map((name) => ({
    id:
      assigneeOptionsByName.get(normalizeName(name))?.id ??
      name.trim().toLowerCase().replace(/\s+/g, "-"),
    name,
    avatarUrl:
      assigneeOptionsByName.get(normalizeName(name))?.avatarUrl ?? undefined,
    role: "PIC",
  }))
}

function mapNoteType(value: string): NoteType {
  switch (value) {
    case "audio":
      return "audio"
    case "meeting":
      return "meeting"
    default:
      return "general"
  }
}

function mapNoteStatus(value: string): NoteStatus {
  return value === "processing" ? "processing" : "completed"
}

function mapQuickLinkType(value: string): QuickLink["type"] {
  switch (value) {
    case "pdf":
      return "pdf"
    case "zip":
      return "zip"
    case "fig":
      return "fig"
    case "doc":
      return "doc"
    default:
      return "file"
  }
}

function mapProjectStatusToBacklogLabel(
  status: OrganizationProjectRecord["status"]
): BacklogSummary["statusLabel"] {
  switch (status) {
    case "active":
      return "Active"
    case "planned":
      return "Planned"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return "Backlog"
  }
}

function mapTaskStatus(
  status: MemberWorkspaceProjectTaskRecord["status"]
): WorkstreamTask["status"] {
  switch (status) {
    case "done":
      return "done"
    case "in-progress":
      return "in-progress"
    default:
      return "todo"
  }
}

function mapTimelineStatus(
  status:
    | MemberWorkspaceProjectTaskRecord["status"]
    | OrganizationProjectRecord["status"]
): TimelineTask["status"] {
  switch (status) {
    case "done":
    case "completed":
      return "done"
    case "in-progress":
    case "active":
      return "in-progress"
    default:
      return "planned"
  }
}

function buildProjectMeta(project: OrganizationProjectRecord): ProjectMeta {
  return {
    priorityLabel: toTitleCase(project.priority),
    sprintLabel:
      [project.type_label, project.duration_label].filter(Boolean).join(" ") ||
      `${differenceInCalendarDays(parseDateOnly(project.end_date), parseDateOnly(project.start_date)) + 1} days`,
    lastSyncLabel: format(new Date(project.updated_at), "MMM d, yyyy"),
  }
}

function buildProjectScope(
  scopeIn: string[],
  scopeOut: string[]
): ProjectScope {
  return {
    inScope: scopeIn,
    outOfScope: scopeOut,
  }
}

function buildProjectKeyFeatures(
  p0: string[],
  p1: string[],
  p2: string[]
): KeyFeatures {
  return {
    p0,
    p1,
    p2,
  }
}

function buildProjectTime(project: OrganizationProjectRecord): TimeSummary {
  const startDate = parseDateOnly(project.start_date)
  const endDate = parseDateOnly(project.end_date)
  const dayCount = Math.max(differenceInCalendarDays(endDate, startDate) + 1, 1)
  const schedule = getProjectSchedule(project.start_date, project.end_date)

  return {
    estimateLabel: project.duration_label || `${dayCount} days`,
    dueDate: endDate,
    daysRemainingLabel: schedule?.status ?? "No dates set",
    progressPercent: schedule?.progress ?? 0,
  }
}

function buildProjectBacklog(
  project: OrganizationProjectRecord,
  members: User[]
): BacklogSummary {
  return {
    statusLabel: mapProjectStatusToBacklogLabel(project.status),
    groupLabel: project.type_label || "General",
    priorityLabel: toTitleCase(project.priority),
    labelBadge: project.tags[0] ? toTitleCase(project.tags[0]) : "Project",
    picUsers: members,
    supportUsers: [],
  }
}

function buildProjectWorkstreams(
  project: OrganizationProjectRecord,
  tasks: MemberWorkspaceProjectTaskRecord[],
  members: User[]
): WorkstreamGroup[] {
  const groups = new Map<string, WorkstreamTask[]>()

  for (const task of tasks) {
    const groupName =
      task.workstream_name?.trim() ||
      (task.task_type === "bug"
        ? "Bugs"
        : task.task_type === "improvement"
          ? "Improvements"
          : "Tasks")
    const list = groups.get(groupName) ?? []
    list.push({
      id: task.id,
      name: task.title,
      status: mapTaskStatus(task.status),
      dueLabel: format(parseDateOnly(task.end_date), "MMM d"),
      assignee:
        task.assignee_id && task.assignee_name
          ? {
              id: task.assignee_id,
              name: task.assignee_name,
              avatarUrl: task.assignee_avatar_url?.trim() || undefined,
            }
          : undefined,
      startDate: parseDateOnly(task.start_date),
      endDate: parseDateOnly(task.end_date),
      sortOrder: task.sort_order ?? 0,
      priority: task.priority as WorkstreamTask["priority"],
      tag: task.tag_label?.trim() || toTitleCase(task.task_type),
      description: task.description?.trim() || undefined,
    })
    groups.set(groupName, list)
  }

  return Array.from(groups.entries()).map(([name, items], index) => ({
    id: `${project.id}-group-${index + 1}`,
    name,
    tasks: items.sort((left, right) => {
      const sortOrderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
      if (sortOrderDiff !== 0) {
        return sortOrderDiff
      }

      return left.startDate!.getTime() - right.startDate!.getTime()
    }),
  }))
}

function buildProjectTimeline(
  project: OrganizationProjectRecord,
  tasks: MemberWorkspaceProjectTaskRecord[]
): TimelineTask[] {
  if (tasks.length === 0) {
    return [
      {
        id: `${project.id}-timeline-1`,
        name: project.name,
        startDate: parseDateOnly(project.start_date),
        endDate: parseDateOnly(project.end_date),
        status: mapTimelineStatus(project.status),
      },
    ]
  }

  return tasks.map((task) => ({
    assignee: task.assignee_id && task.assignee_name ? {
      id: task.assignee_id, name: task.assignee_name,
      avatarUrl: task.assignee_avatar_url?.trim() || undefined,
    } : undefined,
    id: task.id,
    name: task.title,
    startDate: parseDateOnly(task.start_date),
    endDate: parseDateOnly(task.end_date),
    status: mapTimelineStatus(task.status),
  }))
}

function buildProjectNotes(
  notes: MemberWorkspaceProjectNoteRecord[]
): ProjectNote[] {
  return notes.map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content?.trim() || undefined,
    noteType: mapNoteType(note.note_type),
    status: mapNoteStatus(note.status),
    addedDate: new Date(note.created_at),
    addedBy: {
      id: note.created_by,
      name: note.created_by_name?.trim() || "Unknown member",
      avatarUrl: note.created_by_avatar_url?.trim() || undefined,
    },
  }))
}

function buildProjectQuickLinks(
  links: MemberWorkspaceProjectQuickLinkRecord[]
): QuickLink[] {
  return links.map((link) => ({
    id: link.id,
    name: link.name,
    type: mapQuickLinkType(link.link_type),
    sizeMB: Number.isFinite(link.size_mb) ? Number(link.size_mb) : 0,
    url: link.url,
  }))
}

function buildProjectFiles(
  assets: MemberWorkspaceProjectAssetRecord[]
): ProjectFile[] {
  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    type: mapQuickLinkType(asset.asset_type),
    sizeMB: asset.size_bytes
      ? Number((asset.size_bytes / (1024 * 1024)).toFixed(1))
      : 0,
    url:
      asset.external_url?.trim() ||
      buildProjectAssetOpenPath({
        assetId: asset.id,
        projectId: asset.project_id,
      }),
    addedBy: {
      id: asset.created_by,
      name: asset.created_by_name?.trim() || "Unknown member",
      avatarUrl: asset.created_by_avatar_url?.trim() || undefined,
    },
    addedDate: new Date(asset.created_at),
    description: asset.description?.trim() || undefined,
    isLinkAsset: Boolean(asset.external_url),
  }))
}

export function buildMemberWorkspaceProjectDetails({
  project,
  tasks,
  notes,
  quickLinks,
  assets,
  assigneeOptions = [],
  projectMembers,
  overviewDocument,
  activity,
  activityState,
  scheduleAvailable = false,
  scheduleConfirmed = false,
}: {
  project: OrganizationProjectRecord
  tasks: MemberWorkspaceProjectTaskRecord[]
  notes?: MemberWorkspaceProjectNoteRecord[]
  quickLinks?: MemberWorkspaceProjectQuickLinkRecord[]
  assets?: MemberWorkspaceProjectAssetRecord[]
  projectMembers?: User[]
  assigneeOptions?: MemberWorkspacePersonOption[]
  overviewDocument?: MemberWorkspaceProjectOverviewDocumentRecord | null
  activity?: ProjectActivityItem[]
  activityState?: ProjectDetails["activityState"]
  scheduleAvailable?: boolean
  scheduleConfirmed?: boolean
}): ProjectDetails {
  const members = projectMembers ?? buildUsers(project.member_labels ?? [], assigneeOptions)
  const files = buildProjectFiles(assets ?? [])
  const explicitQuickLinks = buildProjectQuickLinks(quickLinks ?? [])
  const overviewDocumentHtml =
    overviewDocument?.document_html?.trim() || project.description?.trim() || ""
  const overview = buildMemberWorkspaceProjectOverviewContent({
    project: {
      ...project,
      description: overviewDocumentHtml,
    },
    tasks,
  })

  return {
    id: project.id,
    name: project.name,
    description: overview.description,
    overviewDocument: overviewDocumentHtml || undefined,
    meta: buildProjectMeta(project),
    scope: buildProjectScope(overview.scopeIn, overview.scopeOut),
    outcomes: overview.outcomes,
    keyFeatures: buildProjectKeyFeatures(
      overview.keyFeaturesP0,
      overview.keyFeaturesP1,
      overview.keyFeaturesP2
    ),
    timelineTasks: buildProjectTimeline(project, tasks),
    workstreams: buildProjectWorkstreams(project, tasks, members),
    time: {
      ...buildProjectTime(project),
      scheduleAvailable,
      schedule: scheduleConfirmed || (project.created_source === "user" && !project.starter_seed_key)
        ? { startDate: project.start_date, endDate: project.end_date }
        : null,
    },
    backlog: {
      ...buildProjectBacklog(project, members),
      ...(projectMembers ? { picLabel: "Owner", supportLabel: "Contributors", picUsers: members.slice(0, 1), supportUsers: members.slice(1) } : {}),
    },
    quickLinks: explicitQuickLinks,
    files,
    notes: buildProjectNotes(notes ?? []),
    activity: activity ?? [],
    ...(activityState ? { activityState } : {}),
    source: mapOrganizationProjectToViewModel(project),
  }
}
