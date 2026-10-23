import "server-only"

import { z } from "zod"
import type { Database } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

// Fiscal access is project-only reviewer access, never host-organization access.
export async function resolveWorkspaceProjectScope({ supabase, userId, projectId }: {
  supabase: Pick<SupabaseClient<Database>, "rpc">
  userId: string
  projectId: string
}) {
  if (!z.string().uuid().safeParse(projectId).success) return "denied"
  const result = await supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: projectId, p_user_id: userId,
  })
  if (result.error) return "denied"
  if (result.data === true) return "fiscal"
  return result.data === null ? "ordinary" : "denied"
}

// Ordinary write tools retain their existing denial for fiscal projects.
export async function isOrdinaryWorkspaceProject(input: Parameters<typeof resolveWorkspaceProjectScope>[0]) {
  return await resolveWorkspaceProjectScope(input) === "ordinary"
}
