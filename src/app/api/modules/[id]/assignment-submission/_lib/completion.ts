import type { Database } from "@/lib/supabase"
import {
  markModuleCompleted,
  parseAssignmentCompletionMode,
  parseAssignmentFields,
  shouldTreatAssignmentSubmissionAsComplete,
} from "@/lib/modules"
import { createNotification } from "@/lib/notifications"

import type { ModuleMeta, SupabaseServerClient } from "./types"

type ProcessModuleCompletionParams = {
  supabase: SupabaseServerClient
  moduleId: string
  userId: string
  actorId?: string
  moduleMeta: ModuleMeta
  modulePath: string | null
}

export async function processModuleCompletion({
  supabase,
  moduleId,
  userId,
  actorId = userId,
  moduleMeta,
  modulePath,
}: ProcessModuleCompletionParams): Promise<void> {
  try {
    await markModuleCompleted({ moduleId, userId })
    const notifyResult = await createNotification(supabase, {
      userId,
      title: "Module completed",
      description: moduleMeta.title ? `You completed ${moduleMeta.title}.` : "You completed a module.",
      href: modulePath,
      tone: "success",
      type: "module_completed",
      actorId,
      metadata: { moduleId },
    })
    if ("error" in notifyResult) {
      console.error("Failed to create module completion notification", notifyResult.error)
    }

    const { data: classModules, error: classModulesError } = await supabase
      .from("modules" satisfies keyof Database["public"]["Tables"])
      .select("id")
      .eq("class_id", moduleMeta.class_id)
      .eq("is_published", true)

    if (classModulesError) {
      console.error("Failed to load class modules for completion check", classModulesError)
      return
    }

    if (!classModules?.length) {
      return
    }

    const classModuleIds = classModules.map((module) => module.id)
    const [progressResult, submissionResult, assignmentResult] = await Promise.all([
      supabase
        .from("module_progress")
        .select("module_id, status")
        .eq("user_id", userId)
        .in("module_id", classModuleIds)
        .returns<Array<{ module_id: string; status: string | null }>>(),
      supabase
        .from("assignment_submissions")
        .select("module_id, answers, status")
        .eq("user_id", userId)
        .in("module_id", classModuleIds)
        .returns<Array<{ module_id: string; answers: unknown; status: string | null }>>(),
      supabase
        .from("module_assignments")
        .select("module_id, schema, complete_on_submit")
        .in("module_id", classModuleIds)
        .returns<Array<{ module_id: string; schema: unknown; complete_on_submit: boolean | null }>>(),
    ])

    if (progressResult.error) {
      console.error("Failed to load class progress for completion check", progressResult.error)
    }
    if (submissionResult.error) {
      console.error("Failed to load class submissions for completion check", submissionResult.error)
    }
    if (assignmentResult.error) {
      console.error("Failed to load class assignments for completion check", assignmentResult.error)
    }

    const progressStatusByModuleId = new Map<string, string>()
    for (const row of progressResult.error ? [] : progressResult.data ?? []) {
      if (row.status) progressStatusByModuleId.set(row.module_id, row.status)
    }

    const submissionByModuleId = new Map<string, { answers: Record<string, unknown>; status: string }>()
    for (const row of submissionResult.error ? [] : submissionResult.data ?? []) {
      if (!row.status) continue
      submissionByModuleId.set(row.module_id, {
        answers:
          row.answers &&
          typeof row.answers === "object" &&
          !Array.isArray(row.answers)
            ? (row.answers as Record<string, unknown>)
            : {},
        status: row.status,
      })
    }

    const assignmentByModuleId = new Map<
      string,
      {
        completeOnSubmit: boolean
        completionMode: ReturnType<typeof parseAssignmentCompletionMode>
        fields: ReturnType<typeof parseAssignmentFields>
      }
    >()
    for (const row of assignmentResult.error ? [] : assignmentResult.data ?? []) {
      assignmentByModuleId.set(row.module_id, {
        completeOnSubmit: Boolean(row.complete_on_submit),
        completionMode: parseAssignmentCompletionMode(row.schema),
        fields: parseAssignmentFields(row.schema),
      })
    }

    const completedModuleIds = new Set<string>()
    for (const classModuleId of classModuleIds) {
      const progressStatus = progressStatusByModuleId.get(classModuleId)
      if (progressStatus === "completed") {
        completedModuleIds.add(classModuleId)
        continue
      }
      const submission = submissionByModuleId.get(classModuleId)
      const assignment = assignmentByModuleId.get(classModuleId)
      if (
        submission &&
        assignment &&
        shouldTreatAssignmentSubmissionAsComplete({
          completeOnSubmit: assignment.completeOnSubmit,
          completionMode: assignment.completionMode,
          fields: assignment.fields,
          answers: submission.answers,
          status: submission.status,
        })
      ) {
        completedModuleIds.add(classModuleId)
      }
    }

    const classCompleted = completedModuleIds.size === classModuleIds.length
    if (!classCompleted) {
      return
    }

    const { data: existingNotifications, error: existingError } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "class_completed")
      .contains("metadata", { classId: moduleMeta.class_id })
      .limit(1)

    if (existingError) {
      console.error("Failed to check class completion notifications", existingError)
      return
    }

    if (existingNotifications?.length) {
      return
    }

    const classTitle = moduleMeta.classes?.title?.trim() || "Class"
    const classSlug = moduleMeta.classes?.slug ?? null
    const classHref = modulePath ?? (classSlug ? `/class/${classSlug}/module/1` : null)
    const classNotifyResult = await createNotification(supabase, {
      userId,
      title: "Class completed",
      description: `You completed ${classTitle}.`,
      href: classHref,
      tone: "success",
      type: "class_completed",
      actorId,
      metadata: { classId: moduleMeta.class_id, classTitle },
    })
    if ("error" in classNotifyResult) {
      console.error("Failed to create class completion notification", classNotifyResult.error)
    }
  } catch (completionError) {
    // Surface as non-fatal so submission still succeeds.
    console.error("Failed to mark module complete", completionError)
  }
}
