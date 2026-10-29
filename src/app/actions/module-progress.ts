"use server"

import { revalidatePath } from "next/cache"

import { resolveOrganizationLearningContext } from "@/lib/accelerator/organization-context"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import type { Database } from "@/lib/supabase/types"

type Result = { ok: true } | { error: string }

export async function markModuleCompleteAction(moduleId: string): Promise<Result> {
  if (!moduleId) return { error: "Missing module id." }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) return { error: "Unable to load user." }
  if (!user) return { error: "Not authenticated." }

  let learningUserId: string
  try {
    ;({ learningUserId } = await resolveOrganizationLearningContext(supabase, user.id))
  } catch {
    return { error: "Organization access changed. Reopen this lesson and try again." }
  }

  const payload: Database["public"]["Tables"]["module_progress"]["Insert"] = {
    user_id: learningUserId,
    module_id: moduleId,
    status: "completed",
    completed_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabase
    .from("module_progress")
    .upsert(payload, { onConflict: "user_id,module_id" })

  if (upsertError) {
    return { error: "Unable to update progress." }
  }

  revalidatePath("/workspace", "layout")
  revalidatePath("/accelerator", "layout")
  revalidatePath("/my-organization")
  return { ok: true }
}
