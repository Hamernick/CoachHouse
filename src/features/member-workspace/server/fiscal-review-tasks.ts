import "server-only"

import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { MemberWorkspaceTaskItem, MemberWorkspaceTaskStatus } from "../types"

const taskSchema = z.object({
  id: z.string().uuid(), projectId: z.string().uuid(), projectName: z.string(),
  title: z.string(), description: z.string().nullable(),
  status: z.enum(["todo", "in-progress", "done"]), reviewers: z.array(z.string()),
})
const missingFunction = (code?: string) => code === "PGRST202" || code === "42883"

// Server callers supply verified identity. RPCs return only assigned, authorized
// application tasks; no host membership, billing or organization profile joins.
export async function loadFiscalReviewTasks(user: { id: string; name: string; avatarUrl?: string | null }): Promise<MemberWorkspaceTaskItem[]> {
  const { data, error } = await createSupabaseAdminClient({ actorId: user.id }).rpc("list_fiscal_review_tasks", { p_user_id: user.id })
  if (error) {
    if (missingFunction(error.code)) return []
    throw new Error("Unable to load fiscal review tasks.")
  }
  return z.array(taskSchema).parse(data).map((task) => ({
    id: task.id, projectId: task.projectId, projectName: task.projectName,
    projectClient: null, projectStatus: "active", projectPriority: "medium",
    projectTags: [], projectMembers: task.reviewers, projectStartDate: "", projectEndDate: "",
    title: task.title, description: task.description ?? undefined, taskType: "task", status: task.status,
    startDate: "", endDate: "", assignee: { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null },
    // The existing checkbox uses the narrow status RPC below. Full task editing
    // would replace the shared assignments and remains unavailable.
    canUpdate: false,
    capabilities: { status: true, details: false, schedule: false, order: false },
  }))
}

export async function updateFiscalReviewTaskStatus(taskId: string, userId: string, status: MemberWorkspaceTaskStatus): Promise<{ ok: true; projectId: string } | { error: string } | null> {
  const { data, error } = await createSupabaseAdminClient({ actorId: userId }).rpc("update_fiscal_review_task_status", {
    p_task_id: taskId, p_user_id: userId, p_status: status,
  })
  if (error) {
    if (missingFunction(error.code)) return null
    return { error: "Unable to update fiscal review task." }
  }
  if (data === null) return null // Ordinary task; retain its existing authorization path.
  const result = z.object({ ok: z.boolean(), projectId: z.string().uuid().optional() }).safeParse(data)
  if (!result.success || !result.data.ok || !result.data.projectId) return { error: "You do not have access to update that review task." }
  return { ok: true as const, projectId: result.data.projectId }
}
