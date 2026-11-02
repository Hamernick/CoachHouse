"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveOrganizationLearningContext } from "@/lib/accelerator/organization-context"
import { readCompletedModuleStepIds } from "@/lib/accelerator/step-progress"
import { buildAssignmentSections } from "@/lib/modules/assignment-sections"
import { parseAssignmentFields, parseLegacyHomework } from "@/lib/modules/assignment"

type StepResult = { ok: true } | { error: string }

export async function saveModuleStepProgressAction({ moduleId, stepId, expectedOrgId }: {
  moduleId: string
  stepId: string
  expectedOrgId: string
}): Promise<StepResult> {
  if (!expectedOrgId || !stepId.startsWith(`${moduleId}:`)) return { error: "Reopen this lesson before saving progress." }
  const stepKey = stepId.slice(moduleId.length + 1)
  if (!/^(lesson|video|resources|assignment(:[a-zA-Z0-9_-]+)?)$/.test(stepKey) || stepKey.length > 200) {
    return { error: "This lesson step is no longer available. Reload and try again." }
  }
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Sign in again to save progress." }
  try {
    const { learningUserId } = await resolveOrganizationLearningContext(supabase, user.id, expectedOrgId)
    const [moduleResult, contentResult, assignmentResult] = await Promise.all([
      supabase.from("modules").select("id, slug, video_url, deck_path, is_published, classes(is_published, video_url, link1_url, link2_url, link3_url)")
        .eq("id", moduleId).maybeSingle<{ id: string; slug: string; video_url: string | null; deck_path: string | null; is_published: boolean; classes: { is_published: boolean; video_url: string | null; link1_url: string | null; link2_url: string | null; link3_url: string | null } | null }>(),
      supabase.from("module_content").select("video_url, resources, homework").eq("module_id", moduleId).maybeSingle<{ video_url: string | null; resources: unknown; homework: unknown }>(),
      supabase.from("module_assignments").select("schema").eq("module_id", moduleId).maybeSingle<{ schema: unknown }>(),
    ])
    const lesson = moduleResult.data
    if (moduleResult.error || contentResult.error || assignmentResult.error || !lesson?.is_published || !lesson.classes?.is_published) {
      return { error: "Unable to verify this lesson. Reload and try again." }
    }
    const allowed = new Set<string>()
    allowed.add("lesson")
    if (lesson.video_url || contentResult.data?.video_url || lesson.classes.video_url) allowed.add("video")
    const fields = assignmentResult.data
      ? parseAssignmentFields(assignmentResult.data.schema)
      : parseLegacyHomework(contentResult.data?.homework)
    const sections = buildAssignmentSections(fields).tabSections.filter((section) =>
      section.fields.length > 0 || Boolean(section.title?.trim() || section.description?.trim())
    )
    if (assignmentResult.data || fields.length > 0) {
      if (sections.length > 1) sections.forEach((section) => allowed.add(`assignment:${section.id}`))
      else allowed.add("assignment")
    }
    const supplementalResources = ["nfp-registration", "filing-1023", "introduction-idea-to-impact-accelerator", "intro-idea-to-impact-accelerator"].includes(lesson.slug)
    if (!sections.some((section) => section.id === "assignment-overview") &&
      (lesson.deck_path || supplementalResources || lesson.classes.link1_url || lesson.classes.link2_url || lesson.classes.link3_url || (Array.isArray(contentResult.data?.resources) && contentResult.data.resources.length > 0))) allowed.add("resources")
    if (!allowed.has(stepKey)) return { error: "This lesson step changed. Reload and try again." }
    const { data, error } = await supabase.rpc("record_module_step", { p_user_id: learningUserId, p_module_id: moduleId, p_step_key: stepKey })
    if (error || !readCompletedModuleStepIds(moduleId, data).includes(stepId)) {
      return { error: "Progress could not be saved. Retry." }
    }
    revalidatePath("/workspace", "layout")
    revalidatePath("/accelerator", "layout")
    revalidatePath("/my-organization")
    return { ok: true }
  } catch {
    return { error: "Progress could not be saved. Reopen this lesson and retry." }
  }
}
