import { loadPersonalTaskScope } from "./personal-task-scope"
import type { Database } from "@/lib/supabase"
import type { MemberWorkspaceTaskItem } from "../types"

import { actorCanAccessOrganization, actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { loadMemberWorkspacePersonOptionsForOrganizations } from "./person-options"
import { loadTaskAssigneeMap, type TaskAssigneeProfile } from "./task-assignees"
import { ensureStarterTasksForOrg } from "./task-persistence"
import { loadTaskProjectScope } from "./task-project-scope"
import {
  mapTaskRowsToGroups,
  type OrganizationTaskRecord,
} from "./task-starter-data"
import { resolveMemberWorkspaceStorageMode } from "./starter-data"
import {
  isMissingOrganizationProjectsTableError,
  isMissingOrganizationTaskAssigneesTableError,
  isMissingOrganizationTasksTableError,
  toMemberWorkspaceDataError,
} from "./table-errors"

type OrganizationTaskAssignmentRow =
  Database["public"]["Tables"]["organization_task_assignees"]["Row"]

type TaskAssignmentQueryRow = Pick<
  OrganizationTaskAssignmentRow,
  "task_id" | "user_id"
> & {
  organization_tasks:
    | (OrganizationTaskRecord & {
        organization_projects: {
          id: string
          name: string
          client_name: string | null
          status: string
          priority: string
          tags: string[] | null
          member_labels: string[] | null
          type_label: string | null
          duration_label: string | null
          start_date: string
          end_date: string
        } | null
      })
    | null
}

function compareTaskItems(
  left: MemberWorkspaceTaskItem,
  right: MemberWorkspaceTaskItem
) {
  const dateDiff = left.startDate.localeCompare(right.startDate)
  if (dateDiff !== 0) return dateDiff
  return left.title.localeCompare(right.title)
}

function mapTaskAssignmentRowsToItems(
  rows: TaskAssignmentQueryRow[],
  assigneeByTaskId: Map<string, TaskAssigneeProfile>,
  canUpdate: boolean
): MemberWorkspaceTaskItem[] {
  return rows
    .flatMap((row) => {
      const task = row.organization_tasks
      if (!task) return []
      const project = task.organization_projects

      return [
        {
          id: task.id,
          projectId: task.project_id,
          projectName: project?.name ?? "Unassigned Project",
          projectClient: project?.client_name ?? null,
          projectStatus:
            (project?.status as MemberWorkspaceTaskItem["projectStatus"]) ??
            "planned",
          projectPriority:
            (project?.priority as MemberWorkspaceTaskItem["projectPriority"]) ??
            "medium",
          projectTags: project?.tags ?? [],
          projectMembers: project?.member_labels ?? [],
          projectTypeLabel: project?.type_label ?? null,
          projectDurationLabel: project?.duration_label ?? null,
          projectStartDate: project?.start_date ?? task.start_date,
          projectEndDate: project?.end_date ?? task.end_date,
          title: task.title,
          description: task.description ?? undefined,
          taskType: task.task_type as MemberWorkspaceTaskItem["taskType"],
          status: task.status as MemberWorkspaceTaskItem["status"],
          startDate: task.start_date,
          endDate: task.end_date,
          priority:
            (task.priority as MemberWorkspaceTaskItem["priority"]) ??
            "no-priority",
          tagLabel: task.tag_label ?? null,
          workstreamName: task.workstream_name ?? null,
          assignee: assigneeByTaskId.get(task.id) ?? null,
          canUpdate,
        },
      ]
    })
    .sort(compareTaskItems)
}

type AdminTaskQueryRow = Pick<
  OrganizationTaskRecord,
  | "id"
  | "org_id"
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
  | "created_source"
  | "created_by"
> & {
  organization_projects: {
    id: string
    name: string
    client_name: string | null
    status: string
    priority: string
    tags: string[] | null
    member_labels: string[] | null
    type_label: string | null
    duration_label: string | null
    start_date: string
    end_date: string
  } | null
}

function mapAdminTaskRowsToItems(
  rows: AdminTaskQueryRow[],
  assigneeByTaskId: Map<string, TaskAssigneeProfile>,
  canUpdate: boolean,
  organizationNames = new Map<string, string>()
): MemberWorkspaceTaskItem[] {
  return rows
    .map((task) => {
      const project = task.organization_projects
      return {
        id: task.id,
        organizationName: organizationNames.get(task.org_id),
        projectId: task.project_id,
        projectName: project?.name ?? "Organization project",
        projectClient: project?.client_name ?? null,
        projectStatus:
          (project?.status as MemberWorkspaceTaskItem["projectStatus"]) ??
          "planned",
        projectPriority:
          (project?.priority as MemberWorkspaceTaskItem["projectPriority"]) ??
          "medium",
        projectTags: project?.tags ?? [],
        projectMembers: project?.member_labels ?? [],
        projectTypeLabel: project?.type_label ?? null,
        projectDurationLabel: project?.duration_label ?? null,
        projectStartDate: project?.start_date ?? task.start_date,
        projectEndDate: project?.end_date ?? task.end_date,
        title: task.title,
        description: task.description ?? undefined,
        taskType: task.task_type as MemberWorkspaceTaskItem["taskType"],
        status: task.status as MemberWorkspaceTaskItem["status"],
        startDate: task.start_date,
        endDate: task.end_date,
        priority:
          (task.priority as MemberWorkspaceTaskItem["priority"]) ??
          "no-priority",
        tagLabel: task.tag_label ?? null,
        workstreamName: task.workstream_name ?? null,
        assignee: assigneeByTaskId.get(task.id) ?? null,
        canUpdate,
      }
    })
    .sort(compareTaskItems)
}

export async function loadMemberWorkspaceTasksPage() {
  const actor = await resolveMemberWorkspaceActorContext()

  if (actorCanAccessOrganizations(actor)) {
    const { data: myAssignments, error: myAssignmentsError } = await actor.supabase
      .from("organization_task_assignees").select("task_id").eq("user_id", actor.userId)
      .returns<Array<{ task_id: string }>>()
    if (myAssignmentsError) throw toMemberWorkspaceDataError(myAssignmentsError, "Unable to load your assigned tasks.")
    const assignedIds = (myAssignments ?? []).map((row) => row.task_id)
    const personalFilter = assignedIds.length
      ? `created_by.eq.${actor.userId},id.in.(${assignedIds.join(",")})`
      : `created_by.eq.${actor.userId}`
    const [
      { data: orgRows, error: orgRowsError },
      { data: detailRows, error: detailError },
      taskProjectScope,
    ] = await Promise.all([
      actor.supabase
        .from("organization_projects")
        .select("id, org_id")
        .returns<Array<Pick<OrganizationTaskRecord, "id" | "org_id">>>(),
      actor.supabase
        .from("organization_tasks")
        .select(
          "id, org_id, project_id, title, description, task_type, status, start_date, end_date, priority, tag_label, workstream_name, sort_order, created_source, created_by, organization_projects(id, name, client_name, status, priority, tags, member_labels, type_label, duration_label, start_date, end_date)"
        )
        .or(personalFilter)
        .order("start_date", { ascending: true })
        .order("sort_order", { ascending: true })
        .returns<AdminTaskQueryRow[]>(),
      loadTaskProjectScope({
        includeOrganizationAdmin: true,
        supabase: actor.supabase,
      }),
    ])

    if (
      orgRowsError &&
      !isMissingOrganizationProjectsTableError(orgRowsError)
    ) {
      throw toMemberWorkspaceDataError(
        orgRowsError,
        "Unable to load task assignees."
      )
    }

    if (detailError) {
      if (
        isMissingOrganizationTasksTableError(detailError) ||
        isMissingOrganizationProjectsTableError(detailError)
      ) {
        return {
          taskGroups: [],
          storageMode: "empty" as const,
          starterTaskCount: 0,
          hasAnyOrgTasks: false,
          canResetStarterData: false,
          canManageTasks: true,
          scope: "platform-admin" as const,
          assigneeOptions: [],
          projectOptions: [],
        }
      }
      throw toMemberWorkspaceDataError(
        detailError,
        "Unable to load workspace tasks."
      )
    }

    const rows = (detailRows ?? []).filter((task) =>
      taskProjectScope.projectIds.has(task.project_id) && actorCanAccessOrganization(actor, task.org_id)
    )
    const accessibleProjects = (orgRows ?? []).filter((row) => actorCanAccessOrganization(actor, row.org_id))
    const accessibleProjectIds = new Set(accessibleProjects.map((row) => row.id))
    const adminOrgIds = [...new Set(accessibleProjects.map((row) => row.org_id))]
    const [assigneeOptions, assigneeByTaskId, personalScope] = await Promise.all([
      loadMemberWorkspacePersonOptionsForOrganizations({
        orgIds: adminOrgIds,
        supabase: actor.supabase,
        includePlatformAdmins: true,
      }),
      loadTaskAssigneeMap({
        supabase: actor.supabase,
        taskIds: rows.map((task) => task.id),
      }),
      loadPersonalTaskScope({ tasks: rows, userId: actor.userId, supabase: actor.supabase }),
    ])

    return {
      taskGroups: mapTaskRowsToGroups(
        mapAdminTaskRowsToItems(rows.filter((task) => personalScope.taskIds.has(task.id)), assigneeByTaskId, true, personalScope.organizationNames)
      ),
      storageMode: resolveMemberWorkspaceStorageMode(rows),
      starterTaskCount: rows.filter(
        (task) => task.created_source === "starter_seed"
      ).length,
      hasAnyOrgTasks: rows.length > 0,
      canResetStarterData: false,
      canManageTasks: true,
      scope: "platform-admin" as const,
      assigneeOptions: [actor.currentUser, ...assigneeOptions.filter((person) => person.id !== actor.userId)],
      projectOptions: taskProjectScope.projectOptions.filter((project) => accessibleProjectIds.has(project.id)),
    }
  }

  const [, assigneeOptions, taskProjectScope] = await Promise.all([
    ensureStarterTasksForOrg({
      canEdit: actor.canEdit,
      orgId: actor.activeOrg.orgId,
      userId: actor.userId,
      supabase: actor.supabase,
    }),
    loadMemberWorkspacePersonOptionsForOrganizations({
      orgIds: [actor.activeOrg.orgId],
      supabase: actor.supabase,
    }),
    loadTaskProjectScope({
      orgId: actor.activeOrg.orgId,
      supabase: actor.supabase,
    }),
  ])

  const { projectIds, projectOptions } = taskProjectScope

  if (projectIds.size === 0) {
    return {
      taskGroups: [],
      storageMode: "empty" as const,
      starterTaskCount: 0,
      hasAnyOrgTasks: false,
      canResetStarterData: false,
      canManageTasks: actor.canEdit,
      scope: "organization" as const,
      assigneeOptions,
      projectOptions,
    }
  }

  const [
    { data: organizationTaskRows, error: organizationTasksError },
    { data: assignedRows, error: assignedRowsError },
  ] = await Promise.all([
    actor.supabase
      .from("organization_tasks")
      .select("id, project_id, created_source")
      .eq("org_id", actor.activeOrg.orgId)
      .neq("created_source", "system")
      .returns<
        Array<
          Pick<OrganizationTaskRecord, "id" | "project_id" | "created_source">
        >
      >(),
    actor.supabase
      .from("organization_task_assignees")
      .select(
        "task_id, user_id, organization_tasks!inner(id, org_id, project_id, title, description, task_type, status, start_date, end_date, priority, tag_label, workstream_name, sort_order, created_source, starter_seed_key, starter_seed_version, created_by, updated_by, created_at, updated_at, organization_projects(id, name, client_name, status, priority, tags, member_labels, type_label, duration_label, start_date, end_date))"
      )
      .eq("org_id", actor.activeOrg.orgId)
      .eq("user_id", actor.userId)
      .returns<TaskAssignmentQueryRow[]>(),
  ])

  if (organizationTasksError) {
    if (isMissingOrganizationTasksTableError(organizationTasksError)) {
      return {
        taskGroups: [],
        storageMode: "empty" as const,
        starterTaskCount: 0,
        hasAnyOrgTasks: false,
        canResetStarterData: false,
        canManageTasks: actor.canEdit,
        scope: "organization" as const,
        assigneeOptions,
        projectOptions,
      }
    }
    throw toMemberWorkspaceDataError(
      organizationTasksError,
      "Unable to load workspace tasks."
    )
  }

  if (assignedRowsError) {
    if (
      isMissingOrganizationTaskAssigneesTableError(assignedRowsError) ||
      isMissingOrganizationTasksTableError(assignedRowsError) ||
      isMissingOrganizationProjectsTableError(assignedRowsError)
    ) {
      return {
        taskGroups: [],
        storageMode: "empty" as const,
        starterTaskCount: 0,
        hasAnyOrgTasks: false,
        canResetStarterData: false,
        canManageTasks: actor.canEdit,
        scope: "organization" as const,
        assigneeOptions,
        projectOptions,
      }
    }
    throw toMemberWorkspaceDataError(
      assignedRowsError,
      "Unable to load assigned workspace tasks."
    )
  }

  const taskRows = (organizationTaskRows ?? []).filter((task) =>
    projectIds.has(task.project_id)
  )
  const scopedAssignedRows = (assignedRows ?? []).filter((row) =>
    projectIds.has(row.organization_tasks?.project_id ?? "")
  )
  const assigneeByTaskId = new Map(
    scopedAssignedRows
      .map((row) => row.organization_tasks?.id)
      .filter((id): id is string => Boolean(id))
      .map((taskId) => [taskId, actor.currentUser] as const)
  )
  const organizationScope = await loadPersonalTaskScope({
    tasks: scopedAssignedRows.flatMap((row) => row.organization_tasks ? [row.organization_tasks] : []),
    userId: actor.userId,
    supabase: actor.supabase,
  })
  const taskItems = mapTaskAssignmentRowsToItems(
    scopedAssignedRows,
    assigneeByTaskId,
    actor.canEdit
  ).map((task) => ({
    ...task,
    organizationName: organizationScope.organizationNames.get(actor.activeOrg.orgId),
  }))
  const starterTaskCount = taskRows.filter(
    (task) => task.created_source === "starter_seed"
  ).length

  return {
    taskGroups: mapTaskRowsToGroups(taskItems),
    storageMode: resolveMemberWorkspaceStorageMode(taskRows),
    starterTaskCount,
    hasAnyOrgTasks: taskRows.length > 0,
    canResetStarterData: actor.canEdit && starterTaskCount > 0,
    canManageTasks: actor.canEdit,
    scope: "organization" as const,
    assigneeOptions,
    projectOptions,
  }
}
