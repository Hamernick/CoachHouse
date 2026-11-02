import type { Json } from "@/lib/supabase/schema/json"

export type ModuleNotesDraft = { content: string; base: string; revision: Json | null }
export function moduleNotesDraftKey(scope: string, moduleId: string) {
  return `module-notes-draft-v1-${scope}-${moduleId}`
}
export function readModuleNotesDraft(key: string): ModuleNotesDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null")
    if (value && typeof value.content === "string" && typeof value.base === "string" && "revision" in value) return value
  } catch { /* Storage may be unavailable. */ }
  return null
}
export function writeModuleNotesDraft(key: string, draft: ModuleNotesDraft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft))
    else localStorage.removeItem(key)
    return true
  } catch { return false }
}

export function discardReviewedModuleNotesDraft(key: string, reviewed: ModuleNotesDraft | null) {
  const stored = readModuleNotesDraft(key)
  if (stored && JSON.stringify(stored) === JSON.stringify(reviewed)) {
    return writeModuleNotesDraft(key, null)
  }
  return false
}
