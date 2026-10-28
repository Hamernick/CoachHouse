"use server"

import { resolveOrganizationLearningContext } from "@/lib/accelerator/organization-context"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import type { Json } from "@/lib/supabase/schema/json"
import { trackUserJourneyMilestone } from "@/lib/user-journey"

export type ModuleNotesPayload = {
  content: string
  format: "markdown"
}

type ModuleNotesResult = { ok: true; notes: ModuleNotesPayload | null } | { error: string }
type ModuleNotesSaveResult = { ok: true; notes: ModuleNotesPayload | null } | { error: string }

function parseNotes(value: Json | null | undefined): ModuleNotesPayload | null {
  if (!value) return null
  if (typeof value === "string") {
    return { content: value, format: "markdown" }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const content = typeof record.content === "string" ? record.content : ""
    if (!content.trim()) return null
    return { content, format: "markdown" }
  }
  return null
}

export async function getModuleNotesAction(moduleId: string, expectedOrgId?: string): Promise<ModuleNotesResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  let learningUserId: string
  try {
    ;({ learningUserId } = await resolveOrganizationLearningContext(supabase, user.id, expectedOrgId))
  } catch {
    return { error: "Organization access changed. Reopen this lesson and try again." }
  }

  const { data, error: selectError } = await supabase
    .from("module_progress")
    .select("notes")
    .eq("user_id", learningUserId)
    .eq("module_id", moduleId)
    .maybeSingle<{ notes: Json | null }>()

  if (selectError) return { error: "Unable to load notes." }

  return { ok: true, notes: parseNotes(data?.notes ?? null) }
}

export async function saveModuleNotesAction(
  moduleId: string,
  content: string,
  expectedOrgId?: string,
): Promise<ModuleNotesSaveResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return { error: "Unable to load user." }
  }
  if (!user) return { error: "Not authenticated." }

  let learningUserId: string
  try {
    ;({ learningUserId } = await resolveOrganizationLearningContext(supabase, user.id, expectedOrgId))
  } catch {
    return { error: "Organization access changed. Reopen this lesson and try again." }
  }

  const trimmed = content.trim()
  const notesPayload: ModuleNotesPayload | null = trimmed.length > 0 ? { content: trimmed, format: "markdown" } : null

  const { error: upsertError } = await supabase
    .from("module_progress")
    .upsert(
      {
        user_id: learningUserId,
        module_id: moduleId,
        notes: notesPayload as Json | null,
      },
      { onConflict: "user_id,module_id" },
    )

  if (upsertError) return { error: "Unable to save notes." }

  if (notesPayload) {
    await trackUserJourneyMilestone({
      userId: user.id,
      orgId: learningUserId,
      eventName: "module_note_saved",
      journey: "workspace_activation",
      source: "module_notes_action",
      surface: "module_notes",
      checkpoint: "first_module_note_saved",
      metadata: {
        moduleId,
        contentLength: notesPayload.content.length,
      },
    })
  }

  return { ok: true, notes: notesPayload }
}
