"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { parseScheduleDay } from "../lib/project-schedule"
import type {
  ProjectTimelineActions,
  TimelineTask,
} from "../lib/project-timeline-types"
import { resolveProjectTimelineContext } from "./project-timeline-context"
import { transitionOrganizationProjectSchedule } from "./project-transition-support"

const day = z
  .string()
  .refine((value) => value === "" || parseScheduleDay(value) !== null)
const datesSchema = z
  .object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid().optional(),
    startDate: day,
    endDate: day,
    expectedStartDate: day,
    expectedEndDate: day,
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate
  )
const status = z.enum(["todo", "in-progress", "waiting", "done"])
const statusSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  status,
  expectedStatus: status,
})
const stale = {
  error: "This item changed. Refresh the timeline and try again.",
}
function refresh(projectId: string) {
  for (const path of [
    "/tasks",
    "/projects",
    "/organizations",
    "/admin/dashboard",
    `/projects/${projectId}`,
    `/organizations/${projectId}`,
  ])
    revalidatePath(path)
}

export const loadProjectTimelineAction: ProjectTimelineActions["load"] = async (
  projectId
) => {
  const context = await resolveProjectTimelineContext(projectId)
  if ("error" in context) return context
  const tasks: TimelineTask[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await context.actor.supabase
      .from("organization_tasks")
      .select(
        "id, project_id, title, status, start_date, end_date, created_source"
      )
      .eq("project_id", context.project.id)
      .eq("org_id", context.project.org_id)
      .order("sort_order")
      .order("id")
      .range(offset, offset + 499)
    if (error) return { error: "Unable to load tasks. Try again." }
    for (const row of data ?? [])
      tasks.push({
        id: row.id,
        projectId: row.project_id,
        name: row.title,
        status: status.safeParse(row.status).success
          ? (row.status as TimelineTask["status"])
          : "todo",
        startDate: row.start_date ?? "",
        endDate: row.end_date ?? "",
        canEdit: context.canEdit && row.created_source !== "system",
      })
    if ((data?.length ?? 0) < 500) break
  }
  return { tasks, canEdit: context.canEdit }
}

export const saveProjectTimelineDatesAction: ProjectTimelineActions["dates"] =
  async (input) => {
    const parsed = datesSchema.safeParse(input)
    if (!parsed.success)
      return {
        error: "Choose valid dates, with the due date on or after the start.",
      }
    const value = parsed.data
    const context = await resolveProjectTimelineContext(value.projectId, true)
    if ("error" in context) return context
    if (value.taskId) {
      // Compare only schedule fields and write only schedule fields: concurrent
      // title/status/assignment edits survive, while concurrent date edits fail.
      let query = createSupabaseAdminClient({ actorId: context.actor.userId })
        .from("organization_tasks")
        .update({
          start_date: value.startDate || null,
          end_date: value.endDate || null,
          updated_by: context.actor.userId,
        })
        .eq("id", value.taskId)
        .eq("project_id", context.project.id)
        .eq("org_id", context.project.org_id)
        .neq("created_source", "system")
      query = value.expectedStartDate
        ? query.eq("start_date", value.expectedStartDate)
        : query.is("start_date", null)
      query = value.expectedEndDate
        ? query.eq("end_date", value.expectedEndDate)
        : query.is("end_date", null)
      const { data, error } = await query
        .select("id, start_date, end_date")
        .maybeSingle()
      if (error)
        return { error: "Unable to save dates. Refresh before trying again." }
      if (!data) return stale
      refresh(context.project.id)
      return {
        ok: true,
        startDate: data.start_date ?? "",
        endDate: data.end_date ?? "",
      }
    }
    const { data: project, error } = await context.actor.supabase
      .from("organization_projects")
      .select("start_date, end_date, updated_at, recurrence")
      .eq("id", context.project.id)
      .eq("org_id", context.project.org_id)
      .maybeSingle()
    if (error || !project)
      return { error: "Unable to load project dates. Try again." }
    if (
      (project.start_date ?? "") !== value.expectedStartDate ||
      (project.end_date ?? "") !== value.expectedEndDate
    )
      return stale
    if (
      project.recurrence === "monthly" &&
      (!value.startDate || !value.endDate)
    )
      return { error: "Monthly projects require both dates." }
    const result = await transitionOrganizationProjectSchedule({
      actorId: context.actor.userId,
      projectId: context.project.id,
      expectedOrgId: context.project.org_id,
      expectedUpdatedAt: project.updated_at,
      startDate: value.startDate || null,
      endDate: value.endDate || null,
    })
    if ("error" in result) return result
    refresh(context.project.id)
    return { ok: true, startDate: value.startDate, endDate: value.endDate }
  }

export const saveProjectTimelineStatusAction: ProjectTimelineActions["status"] =
  async (input) => {
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return { error: "Choose a valid task status." }
    const value = parsed.data
    const context = await resolveProjectTimelineContext(value.projectId, true)
    if ("error" in context) return context
    const { data, error } = await createSupabaseAdminClient({
      actorId: context.actor.userId,
    })
      .from("organization_tasks")
      .update({ status: value.status, updated_by: context.actor.userId })
      .eq("id", value.taskId)
      .eq("project_id", context.project.id)
      .eq("org_id", context.project.org_id)
      .neq("created_source", "system")
      .eq("status", value.expectedStatus)
      .select("id, status")
      .maybeSingle()
    if (error)
      return { error: "Unable to save status. Refresh before trying again." }
    if (!data) return stale
    refresh(context.project.id)
    return { ok: true, status: value.status }
  }
