"use server"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase"
import { sanitizeNoteContent, noteContentInput } from "@/lib/modules/note-content-server"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"

const moduleIdSchema = z.string().min(1).max(240).regex(/^[\w-]+$/)
const writeSchema = z.object({
  moduleId: moduleIdSchema,
  version: z.string().nullable(),
  editId: z.uuid(),
  body: noteContentInput.nullable(),
})
function payload(notes: Json | null, updatedAt?: string) {
  const record = notes && typeof notes === "object" && !Array.isArray(notes) ? notes : null
  const content = typeof notes === "string" ? notes : typeof record?.content === "string" ? record.content : ""
  return {
    ...sanitizeNoteContent({ content, ...(typeof record?.html === "string" ? { html: record.html } : {}) }),
    updatedAt: typeof record?.editedAt === "string" ? record.editedAt : updatedAt ?? null,
    editId: typeof record?.editId === "string" ? record.editId : null,
  }
}

export async function loadPersonalNote(moduleId: string) {
  if (!moduleIdSchema.safeParse(moduleId).success) return { error: "Invalid lesson." }
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to read your notes." }
  const [{ data, error }, moduleResult] = await Promise.all([
    supabase.from("module_progress").select("notes, updated_at")
      .eq("user_id", user.id).eq("module_id", moduleId).maybeSingle(),
    supabase.from("modules").select("title").eq("id", moduleId).maybeSingle(),
  ])
  if (error) return { error: "Unable to load this note. Try again." }
  const lessonModule = moduleResult.error ? null : moduleResult.data
  const lesson = lessonModule ? {
    title: lessonModule.title?.trim() || "Accelerator lesson",
    moduleId,
    href: getWorkspaceDrawerPath({ tab: "accelerator", moduleId }),
  } : null
  return { body: payload(data?.notes ?? null, data?.updated_at), version: data?.updated_at ?? null, lesson }
}

/** Only the caller's notes field changes. Completion, answers and shared graph stay intact. */
export async function writePersonalNote(input: unknown) {
  const parsed = writeSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the note. Use 20,000 characters or fewer." }
  const { moduleId, version, editId } = parsed.data
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to save your notes." }
  const current = await supabase.from("module_progress").select("notes, updated_at")
    .eq("user_id", user.id).eq("module_id", moduleId).maybeSingle()
  if (current.error) return { error: "Unable to load this note. Your draft is still here." }
  const previous = payload(current.data?.notes ?? null, current.data?.updated_at)
  if (previous.editId === editId || (parsed.data.body === null && current.data?.notes === null))
    return { body: previous, version: current.data?.updated_at ?? null }
  if ((current.data?.updated_at ?? null) !== version)
    return { error: "This lesson changed elsewhere. Copy your draft or load the latest note.", conflict: true }
  let notes: Json | null = null
  try {
    if (parsed.data.body) notes = { ...sanitizeNoteContent(parsed.data.body), format: "markdown", editedAt: new Date().toISOString(), editId }
  } catch { return { error: "Use 20,000 characters or fewer." } }
  const result = current.data
    ? await supabase.from("module_progress").update({ notes }).eq("user_id", user.id).eq("module_id", moduleId)
        .eq("updated_at", version!).select("notes, updated_at").maybeSingle()
    : await supabase.from("module_progress").insert({ user_id: user.id, module_id: moduleId, notes })
        .select("notes, updated_at").single()
  if (result.error || !result.data) return {
    error: "Unable to confirm this save. Your draft is still here. Retry, or load the latest note.",
    conflict: result.error?.code === "23505" || !result.error,
  }
  return { body: payload(result.data.notes, result.data.updated_at), version: result.data.updated_at }
}
