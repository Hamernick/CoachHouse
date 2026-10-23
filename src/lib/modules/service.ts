import { notFound } from "next/navigation"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase"
import { supabaseErrorToError } from "@/lib/supabase/errors"

import {
  type ClassModuleResult,
  type ModuleAssignment,
  type ModuleAssignmentSubmission,
  type ModuleRecord,
  type ModuleResource,
  type ModuleProgressStatus,
} from "./types"
import {
  parseAssignmentCompletionMode,
  shouldTreatAssignmentSubmissionAsComplete,
} from "./assignment-completion"
import { parseAssignmentFields, parseLegacyHomework } from "./assignment"
import {
  buildClassResourcesAndVideo,
  inferResourceProvider,
  resolveClassPublished,
  resolveClassSubtitle,
  type ClassWithModules,
} from "./service-helpers"

export async function getClassModulesForUser({
  classSlug,
  userId,
  forceAdmin = false,
  includeProgress = true,
  supabase: supabaseOverride,
}: {
  classSlug: string
  userId: string
  forceAdmin?: boolean
  includeProgress?: boolean
  supabase?: SupabaseClient<Database, "public">
}): Promise<ClassModuleResult> {
  const supabase = supabaseOverride ?? await createSupabaseServerClient()
  const elevated = forceAdmin ? createSupabaseAdminClient() : null
  const primary = elevated ?? supabase

  let classRow: unknown | null = null
  {
    // Prefer expanded module fields; fall back on 42703
    const { data, error } = await primary
      .from("classes" satisfies keyof Database["public"]["Tables"])
      .select(
        `id, title, description, subtitle, video_url, link1_title, link1_url, link2_title, link2_url, link3_title, link3_url, is_published, modules ( id, idx, slug, title, description, is_published, video_url, content_md, duration_minutes, deck_path )`
      )
      .eq("slug", classSlug)
      .maybeSingle()
    if (error) {
      // Fallback for local schemas missing some columns
      if ((error as { code?: string }).code === "42703") {
        const { data: fallback, error: err2 } = await primary
          .from("classes" satisfies keyof Database["public"]["Tables"])
          .select(`id, title, description, published, modules ( id, idx, slug, title, description, published )`)
          .eq("slug", classSlug)
          .maybeSingle()
        if (err2) throw supabaseErrorToError(err2, "Unable to load class.")
        classRow = fallback
      } else {
        throw supabaseErrorToError(error, "Unable to load class.")
      }
    } else {
      classRow = data
    }
  }

  if (!classRow) {
    try {
      const elevatedClient = elevated ?? createSupabaseAdminClient()
      const { data: adminData } = await elevatedClient
        .from("classes" satisfies keyof Database["public"]["Tables"])
        .select(
          `id, title, description, subtitle, video_url, link1_title, link1_url, link2_title, link2_url, link3_title, link3_url, is_published, modules ( id, idx, slug, title, description, is_published, video_url, content_md, duration_minutes, deck_path )`
        )
        .eq("slug", classSlug)
        .maybeSingle()
      classRow = adminData
    } catch {
      // Ignore; will 404 below if still null
    }
  }

  if (!classRow) {
    notFound()
  }

  const classRecord = classRow as ClassWithModules
  const { classVideoUrl, classResources } = buildClassResourcesAndVideo(classRecord)
  const classSubtitle = resolveClassSubtitle(classRecord)
  const classPublished = resolveClassPublished(classRecord)

  const moduleRows = [...(classRecord.modules ?? [])].sort(
    (a, b) => ((a?.idx ?? 0) - (b?.idx ?? 0))
  )

  if (moduleRows.length === 0) {
    return {
      classId: classRecord.id,
      classTitle: classRecord.title,
      classDescription: classRecord.description ?? null,
      classSubtitle,
      classVideoUrl,
      classResources,
      classPublished,
      modules: [],
      progressMap: {},
    }
  }

  const moduleIds = moduleRows.map((module) => module.id)

  const contentByModuleId = new Map<
    string,
    { videoUrl: string | null; resources: ModuleResource[]; legacyHomework: ReturnType<typeof parseLegacyHomework> }
  >()
  const assignmentByModuleId = new Map<string, ModuleAssignment>()
  const submissionByModuleId = new Map<string, ModuleAssignmentSubmission>()

  const [contentResult, assignmentResult, submissionResult] = await Promise.all([
    primary
      .from("module_content" satisfies keyof Database["public"]["Tables"])
      .select("module_id, video_url, resources, homework")
      .in("module_id", moduleIds)
      .returns<Array<{ module_id: string; video_url: string | null; resources: unknown; homework: unknown }>>(),
    primary
      .from("module_assignments" satisfies keyof Database["public"]["Tables"])
      .select("module_id, schema, complete_on_submit")
      .in("module_id", moduleIds)
      .returns<Array<{ module_id: string; schema: unknown; complete_on_submit: boolean | null }>>(),
    supabase
      .from("assignment_submissions" satisfies keyof Database["public"]["Tables"])
      .select("module_id, answers, status, updated_at")
      .eq("user_id", userId)
      .in("module_id", moduleIds)
      .returns<Array<{ module_id: string; answers: unknown; status: string | null; updated_at: string | null }>>(),
  ])

  const { data: contentRows, error: contentError } = contentResult
  if (contentError) {
    const code = (contentError as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      throw supabaseErrorToError(contentError, "Unable to load module content.")
    }
  } else {
    for (const row of contentRows ?? []) {
      if (!row?.module_id) continue
      const rawResources = Array.isArray(row.resources)
        ? (row.resources as Array<Record<string, unknown>>)
        : []
      const resources: ModuleResource[] = rawResources
        .map((resource) => {
          if (!resource || typeof resource !== "object") return null
          const r = resource as { label?: unknown; url?: unknown }
          const label = typeof r.label === "string" ? r.label.trim() : ""
          const url = typeof r.url === "string" ? r.url.trim() : ""
          if (!label && !url) return null
          return {
            label: label || url,
            url,
            provider: inferResourceProvider(url),
          }
        })
        .filter((value): value is ModuleResource => Boolean(value))

      const legacyHomework = parseLegacyHomework(row.homework)

      contentByModuleId.set(row.module_id, {
        videoUrl: row.video_url ?? null,
        resources,
        legacyHomework,
      })
    }
  }

  const { data: assignmentRows, error: assignmentError } = assignmentResult
  if (assignmentError) {
    const code = (assignmentError as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      throw supabaseErrorToError(assignmentError, "Unable to load module assignment.")
    }
  } else {
    for (const row of assignmentRows ?? []) {
      if (!row?.module_id) continue
      const fields = parseAssignmentFields(row.schema)
      if (fields.length === 0) continue
      assignmentByModuleId.set(row.module_id, {
        fields,
        completeOnSubmit: Boolean(row.complete_on_submit),
        completionMode: parseAssignmentCompletionMode(row.schema),
      })
    }
  }

  const { data: submissionRows, error: submissionError } = submissionResult
  if (submissionError) {
    const code = (submissionError as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      throw supabaseErrorToError(submissionError, "Unable to load assignment submission.")
    }
  } else {
    for (const row of submissionRows ?? []) {
      if (!row?.module_id) continue
      const answers =
        row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
          ? (row.answers as Record<string, unknown>)
          : {}
      const rawStatus = typeof row.status === "string" ? row.status : "submitted"
      const status: ModuleAssignmentSubmission["status"] =
        rawStatus === "accepted" || rawStatus === "revise" ? rawStatus : "submitted"
      submissionByModuleId.set(row.module_id, {
        answers,
        status,
        updatedAt: row.updated_at ?? null,
      })
    }
  }

  const allModules: ModuleRecord[] = moduleRows.map((module, index) => {
    const content = contentByModuleId.get(module.id)
    const assignment = assignmentByModuleId.get(module.id)
    const submission = submissionByModuleId.get(module.id)
    const idxValue =
      typeof module.idx === "number" && Number.isFinite(module.idx) ? module.idx : index + 1
    const legacyAssignment = content?.legacyHomework ?? []
    const resolvedAssignment = assignment
      ? assignment
      : legacyAssignment.length > 0
        ? { fields: legacyAssignment, completeOnSubmit: false, completionMode: "on_submit" as const }
        : null

    const moduleVideo = (module as { video_url?: string | null }).video_url ?? null
    const contentVideo = content?.videoUrl ?? null

    return {
      id: module.id,
      idx: idxValue,
      slug: module.slug,
      title: module.title,
      description: module.description ?? null,
      videoUrl: moduleVideo ?? contentVideo,
      contentMd: (module as { content_md?: string | null }).content_md ?? null,
      durationMinutes: (module as { duration_minutes?: number | null }).duration_minutes ?? null,
      published:
        "is_published" in module
          ? Boolean((module as { is_published?: boolean | null }).is_published)
          : Boolean((module as { published?: boolean | null }).published ?? true),
      hasDeck: Boolean((module as { deck_path?: string | null }).deck_path ?? null),
      resources: content?.resources ?? [],
      assignment: resolvedAssignment,
      assignmentSubmission: submission ?? null,
    }
  })
  const modules: ModuleRecord[] = forceAdmin
    ? allModules
    : allModules.filter((module) => module.published)

  if (modules.length === 0 || !includeProgress) {
    return {
      classId: classRecord.id,
      classTitle: classRecord.title,
      classDescription: classRecord.description ?? null,
      classSubtitle,
      classVideoUrl,
      classResources,
      classPublished,
      modules,
      progressMap: {},
    }
  }

  const { data: progressRows, error: progressError } = await supabase
    .from("module_progress" satisfies keyof Database["public"]["Tables"])
    .select("module_id, status")
    .eq("user_id", userId)
    .in("module_id", moduleIds)
    .returns<Array<{ module_id: string; status: string }>>()

  if (progressError) {
    const code = (progressError as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      throw supabaseErrorToError(progressError, "Unable to load module progress.")
    }
  }

  const progressRecords = progressError ? [] : progressRows ?? []
  const progressStatusByModuleId = new Map<string, ModuleProgressStatus>()
  for (const row of progressRecords) {
    progressStatusByModuleId.set(row.module_id, row.status as ModuleProgressStatus)
  }

  const assignmentMetaByModuleId = new Map<string, ModuleAssignment | null>()
  for (const moduleRecord of modules) {
    assignmentMetaByModuleId.set(moduleRecord.id, moduleRecord.assignment ?? null)
  }

  const progressMap: Record<string, ModuleProgressStatus> = {}
  for (const moduleRecord of modules) {
    const progressStatus = progressStatusByModuleId.get(moduleRecord.id)
    if (progressStatus && progressStatus !== "not_started") {
      progressMap[moduleRecord.id] = progressStatus
      continue
    }

    const submission = submissionByModuleId.get(moduleRecord.id)
    if (!submission) continue

      const assignment = assignmentMetaByModuleId.get(moduleRecord.id)
    const completed = assignment
      ? shouldTreatAssignmentSubmissionAsComplete({
          completeOnSubmit: assignment.completeOnSubmit,
          completionMode: assignment.completionMode,
          fields: assignment.fields,
          answers: submission.answers,
          status: submission.status,
        })
      : false
    progressMap[moduleRecord.id] = completed ? "completed" : "in_progress"
  }

  return {
    classId: classRecord.id,
    classTitle: classRecord.title,
    classDescription: classRecord.description ?? null,
    classSubtitle,
    classVideoUrl,
    classResources,
    classPublished,
    modules,
    progressMap,
  }
}
