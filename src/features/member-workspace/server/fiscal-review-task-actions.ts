"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getServerUser } from "@/server/auth/server-user"
import type { MemberWorkspaceTaskStatus } from "../types"
import { updateFiscalReviewTaskStatus } from "./fiscal-review-tasks"
import { updateMemberWorkspaceTaskStatusAction } from "./task-actions"
import { resolveDirectoryTaskScope } from "./task-directory-scope"

export async function updateDirectoryTaskStatusAction(taskId: string, status: MemberWorkspaceTaskStatus) {
  if (!z.string().uuid().safeParse(taskId).success || !["todo", "in-progress", "waiting", "done"].includes(status)) {
    return { error: "Choose a valid task and status." }
  }
  // This is a personal staff task, not a mutation of the selected support
  // workspace. Bind identity directly to Auth; the RPC enforces assignment and
  // current fiscal reviewer access without changing any other task permissions.
  const { data: { user }, error } = await getServerUser(await createSupabaseServerClient())
  if (error || !user) return { error: "Sign in to update your task." }
  const fiscal = await updateFiscalReviewTaskStatus(taskId, user.id, status)
  if (!fiscal) return updateMemberWorkspaceTaskStatusAction(taskId, status, await resolveDirectoryTaskScope())
  if ("error" in fiscal) return fiscal
  revalidatePath("/tasks")
  revalidatePath(`/projects/${fiscal.projectId}`)
  return { ok: true as const, taskId, status }
}
