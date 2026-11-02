import { readCompletedModuleStepIds } from "./step-progress"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { SidebarClass } from "@/lib/academy"
import { fetchSidebarTree } from "@/lib/academy"
import { isNonProductAcceleratorClass } from "@/lib/accelerator/class-visibility"
import {
  parseAssignmentCompletionMode,
  parseAssignmentFields,
  shouldTreatAssignmentSubmissionAsComplete,
} from "@/lib/modules"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import type { Json } from "@/lib/supabase/schema/json"
import type { Database } from "@/lib/supabase/types"

export type ModuleCardStatus = "not_started" | "in_progress" | "completed"

export type ModuleCard = {
  id: string
  published?: boolean
  slug: string
  title: string
  description: string | null
  href: string
  status: ModuleCardStatus
  index: number
  hasNotes: boolean
  completedStepIds?: string[]
}

export type ModuleGroup = {
  id: string
  published?: boolean
  title: string
  description: string | null
  slug: string
  modules: ModuleCard[]
}

export type AcceleratorProgressSummary = {
  groups: ModuleGroup[]
  totalModules: number
  completedModules: number
  inProgressModules: number
  percent: number
}

export type AcceleratorProgressTotals = Pick<
  AcceleratorProgressSummary,
  "totalModules" | "completedModules" | "inProgressModules" | "percent"
>

type ProgressOptions = {
  supabase?: SupabaseClient<Database, "public">
  userId?: string
  isAdmin?: boolean
  classes?: SidebarClass[]
  basePath?: string
}

function normalizeClassesForProgress(
  classes: SidebarClass[],
  isAdmin: boolean
): SidebarClass[] {
  if (isAdmin) return classes
  return classes
    .filter((klass) => klass.published)
    .map((klass) => ({
      ...klass,
      modules: klass.modules.filter((module) => module.published),
    }))
}

function buildModuleGroups({
  classes,
  progressMap,
  notesMap,
  basePath,
}: {
  classes: SidebarClass[]
  progressMap: Map<string, ModuleCardStatus>
  notesMap: Map<string, boolean>
  basePath: string
}): ModuleGroup[] {
  return classes
    .map((klass) => {
      const modules = klass.modules.map((module) => {
        const status = progressMap.get(module.id) ?? "not_started"
        return {
          id: module.id,
          published: module.published,
          slug: module.slug ?? module.id,
          title: module.title,
          description: module.description ?? null,
          href: `${basePath}/class/${klass.slug}/module/${module.index}`,
          status,
          index: module.index,
          hasNotes: notesMap.get(module.id) === true,
        }
      })

      return {
        id: klass.id,
        published: klass.published,
        title: klass.title,
        description: klass.description ?? null,
        slug: klass.slug,
        modules,
      }
    })
    .filter((group) => group.modules.length > 0)
}

function hasSavedNotes(value: Json | null | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const content = (value as Record<string, unknown>).content
  return typeof content === "string" && content.trim().length > 0
}

function normalizeModuleProgressStatus(
  value: string | null | undefined
): ModuleCardStatus {
  if (value === "completed" || value === "in_progress") return value
  return "not_started"
}

function buildAcceleratorProgressTotals({
  moduleIds,
  progressStatusByModuleId,
  submissionByModuleId,
  assignmentByModuleId,
}: {
  moduleIds: string[]
  progressStatusByModuleId: Map<string, ModuleCardStatus>
  submissionByModuleId: Map<
    string,
    { answers: Record<string, unknown>; status: string }
  >
  assignmentByModuleId: Map<
    string,
    {
      completeOnSubmit: boolean
      completionMode: ReturnType<typeof parseAssignmentCompletionMode>
      fields: ReturnType<typeof parseAssignmentFields>
    }
  >
}): AcceleratorProgressTotals {
  let completedModules = 0
  let inProgressModules = 0

  for (const moduleId of moduleIds) {
    const progressStatus = progressStatusByModuleId.get(moduleId)
    if (progressStatus === "completed") {
      completedModules += 1
      continue
    }

    const submission = submissionByModuleId.get(moduleId)
    if (!submission) {
      if (progressStatus === "in_progress") inProgressModules += 1
      continue
    }

    const assignment = assignmentByModuleId.get(moduleId)
    const completed = assignment
      ? shouldTreatAssignmentSubmissionAsComplete({
          completeOnSubmit: assignment.completeOnSubmit,
          completionMode: assignment.completionMode,
          fields: assignment.fields,
          answers: submission.answers,
          status: submission.status,
        })
      : false
    if (completed) {
      completedModules += 1
      continue
    }

    inProgressModules += 1
  }

  const totalModules = moduleIds.length
  const percent =
    totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0

  return { totalModules, completedModules, inProgressModules, percent }
}

export async function fetchAcceleratorProgressTotalsByUserId({
  supabase: supabaseOverride,
  userIds,
  isAdmin = false,
  classes,
}: Omit<ProgressOptions, "userId" | "basePath"> & {
  userIds: string[]
}): Promise<Map<string, AcceleratorProgressTotals>> {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient())
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  const summaries = new Map<string, AcceleratorProgressTotals>()

  if (uniqueUserIds.length === 0) {
    return summaries
  }

  const classSource =
    classes ??
    (await fetchSidebarTree({
      includeDrafts: Boolean(isAdmin),
      forceAdmin: Boolean(isAdmin),
    }))
  const normalizedClasses = normalizeClassesForProgress(
    classSource,
    Boolean(isAdmin)
  )
  const filteredClasses = normalizedClasses.filter(
    (klass) => !isNonProductAcceleratorClass(klass)
  )
  const moduleIds = filteredClasses.flatMap((klass) =>
    klass.modules.map((module) => module.id)
  )

  if (moduleIds.length === 0) {
    for (const userId of uniqueUserIds) {
      summaries.set(userId, {
        totalModules: 0,
        completedModules: 0,
        inProgressModules: 0,
        percent: 0,
      })
    }
    return summaries
  }

  const [progressResult, submissionResult, assignmentResult] =
    await Promise.all([
      supabase
        .from("module_progress")
        .select("user_id, module_id, status")
        .in("user_id", uniqueUserIds)
        .in("module_id", moduleIds)
        .returns<
          Array<{
            user_id: string
            module_id: string
            status: ModuleCardStatus
          }>
        >(),
      supabase
        .from("assignment_submissions")
        .select("user_id, module_id, answers, status")
        .in("user_id", uniqueUserIds)
        .in("module_id", moduleIds)
        .returns<
          Array<{
            user_id: string
            module_id: string
            answers: unknown
            status: string | null
          }>
        >(),
      supabase
        .from("module_assignments")
        .select("module_id, schema, complete_on_submit")
        .in("module_id", moduleIds)
        .returns<
          Array<{
            module_id: string
            schema: unknown
            complete_on_submit: boolean | null
          }>
        >(),
    ])

  if (progressResult.error) {
    const code = (progressResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load module progress.",
        progressResult.error
      )
    }
  }
  if (submissionResult.error) {
    const code = (submissionResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load assignment submissions.",
        submissionResult.error
      )
    }
  }
  if (assignmentResult.error) {
    const code = (assignmentResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load module assignments.",
        assignmentResult.error
      )
    }
  }

  const progressStatusByUserId = new Map<
    string,
    Map<string, ModuleCardStatus>
  >()
  for (const row of progressResult.error ? [] : (progressResult.data ?? [])) {
    const statuses =
      progressStatusByUserId.get(row.user_id) ??
      new Map<string, ModuleCardStatus>()
    statuses.set(row.module_id, normalizeModuleProgressStatus(row.status))
    progressStatusByUserId.set(row.user_id, statuses)
  }

  const submissionByUserId = new Map<
    string,
    Map<string, { answers: Record<string, unknown>; status: string }>
  >()
  for (const row of submissionResult.error
    ? []
    : (submissionResult.data ?? [])) {
    if (!row.status) continue
    const submissions =
      submissionByUserId.get(row.user_id) ??
      new Map<string, { answers: Record<string, unknown>; status: string }>()
    submissions.set(row.module_id, {
      answers:
        row.answers &&
        typeof row.answers === "object" &&
        !Array.isArray(row.answers)
          ? (row.answers as Record<string, unknown>)
          : {},
      status: row.status,
    })
    submissionByUserId.set(row.user_id, submissions)
  }

  const assignmentByModuleId = new Map<
    string,
    {
      completeOnSubmit: boolean
      completionMode: ReturnType<typeof parseAssignmentCompletionMode>
      fields: ReturnType<typeof parseAssignmentFields>
    }
  >()
  for (const row of assignmentResult.error
    ? []
    : (assignmentResult.data ?? [])) {
    assignmentByModuleId.set(row.module_id, {
      completeOnSubmit: Boolean(row.complete_on_submit),
      completionMode: parseAssignmentCompletionMode(row.schema),
      fields: parseAssignmentFields(row.schema),
    })
  }

  for (const userId of uniqueUserIds) {
    summaries.set(
      userId,
      buildAcceleratorProgressTotals({
        moduleIds,
        progressStatusByModuleId:
          progressStatusByUserId.get(userId) ??
          new Map<string, ModuleCardStatus>(),
        submissionByModuleId:
          submissionByUserId.get(userId) ??
          new Map<
            string,
            { answers: Record<string, unknown>; status: string }
          >(),
        assignmentByModuleId,
      })
    )
  }

  return summaries
}

export async function fetchAcceleratorProgressSummary({
  supabase: supabaseOverride,
  userId,
  isAdmin,
  classes,
  basePath = "/accelerator",
}: ProgressOptions = {}): Promise<AcceleratorProgressSummary> {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient())
  let resolvedUserId = userId
  let resolvedIsAdmin = isAdmin

  if (!resolvedUserId) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError && !isSupabaseAuthSessionMissingError(userError)) {
      console.error(
        "[accelerator-progress] Unable to load Supabase user.",
        userError
      )
      return {
        groups: [],
        totalModules: 0,
        completedModules: 0,
        inProgressModules: 0,
        percent: 0,
      }
    }
    if (!user) {
      return {
        groups: [],
        totalModules: 0,
        completedModules: 0,
        inProgressModules: 0,
        percent: 0,
      }
    }
    resolvedUserId = user.id
  }

  if (resolvedIsAdmin == null) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", resolvedUserId)
      .maybeSingle<{ role: string | null }>()
    resolvedIsAdmin = profile?.role === "admin"
  }

  const classSource =
    classes ??
    (await fetchSidebarTree({
      includeDrafts: Boolean(resolvedIsAdmin),
      forceAdmin: Boolean(resolvedIsAdmin),
    }))

  const normalizedClasses = normalizeClassesForProgress(
    classSource,
    Boolean(resolvedIsAdmin)
  )
  const filteredClasses = normalizedClasses.filter(
    (klass) => !isNonProductAcceleratorClass(klass)
  )
  const moduleIds = filteredClasses.flatMap((klass) =>
    klass.modules.map((module) => module.id)
  )

  if (moduleIds.length === 0) {
    return {
      groups: [],
      totalModules: 0,
      completedModules: 0,
      inProgressModules: 0,
      percent: 0,
    }
  }

  const [progressResult, submissionResult, assignmentResult] =
    await Promise.all([
      supabase
        .from("module_progress")
        .select("module_id, status, notes, step_progress")
        .eq("user_id", resolvedUserId)
        .in("module_id", moduleIds)
        .returns<
          Array<{
            module_id: string
            status: ModuleCardStatus
            notes: Json | null
            step_progress?: Json
          }>
        >(),
      supabase
        .from("assignment_submissions")
        .select("module_id, answers, status")
        .eq("user_id", resolvedUserId)
        .in("module_id", moduleIds)
        .returns<
          Array<{ module_id: string; answers: unknown; status: string | null }>
        >(),
      supabase
        .from("module_assignments")
        .select("module_id, schema, complete_on_submit")
        .in("module_id", moduleIds)
        .returns<
          Array<{
            module_id: string
            schema: unknown
            complete_on_submit: boolean | null
          }>
        >(),
    ])

  if (progressResult.error) {
    const code = (progressResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load module progress.",
        progressResult.error
      )
    }
  }
  if (submissionResult.error) {
    const code = (submissionResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load assignment submissions.",
        submissionResult.error
      )
    }
  }
  if (assignmentResult.error) {
    const code = (assignmentResult.error as { code?: string }).code
    if (code !== "42P01" && code !== "42703") {
      console.error(
        "[accelerator-progress] Unable to load module assignments.",
        assignmentResult.error
      )
    }
  }

  if (progressResult.error || submissionResult.error || assignmentResult.error) {
    throw new Error("Unable to load saved lesson progress. Please retry.")
  }

  const progressMap = new Map<string, ModuleCardStatus>()
  const notesMap = new Map<string, boolean>()
  const progressStatusByModuleId = new Map<string, ModuleCardStatus>()
  const submissionByModuleId = new Map<
    string,
    { answers: Record<string, unknown>; status: string }
  >()
  const assignmentByModuleId = new Map<
    string,
    {
      completeOnSubmit: boolean
      completionMode: ReturnType<typeof parseAssignmentCompletionMode>
      fields: ReturnType<typeof parseAssignmentFields>
    }
  >()

  for (const row of progressResult.error ? [] : (progressResult.data ?? [])) {
    progressStatusByModuleId.set(
      row.module_id,
      normalizeModuleProgressStatus(row.status)
    )
    notesMap.set(row.module_id, hasSavedNotes(row.notes))
  }

  for (const row of submissionResult.error
    ? []
    : (submissionResult.data ?? [])) {
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

  for (const row of assignmentResult.error
    ? []
    : (assignmentResult.data ?? [])) {
    assignmentByModuleId.set(row.module_id, {
      completeOnSubmit: Boolean(row.complete_on_submit),
      completionMode: parseAssignmentCompletionMode(row.schema),
      fields: parseAssignmentFields(row.schema),
    })
  }

  for (const moduleId of moduleIds) {
    const progressStatus = progressStatusByModuleId.get(moduleId)
    if (progressStatus === "completed") {
      progressMap.set(moduleId, progressStatus)
      continue
    }

    const submission = submissionByModuleId.get(moduleId)
    if (!submission) {
      if (progressStatus) progressMap.set(moduleId, progressStatus)
      continue
    }

    const assignment = assignmentByModuleId.get(moduleId)
    const completed = assignment
      ? shouldTreatAssignmentSubmissionAsComplete({
          completeOnSubmit: assignment.completeOnSubmit,
          completionMode: assignment.completionMode,
          fields: assignment.fields,
          answers: submission.answers,
          status: submission.status,
        })
      : false
    const status: ModuleCardStatus = completed ? "completed" : "in_progress"
    progressMap.set(moduleId, status)
  }

  const groups = buildModuleGroups({
    classes: filteredClasses,
    progressMap,
    notesMap,
    basePath,
  })

  const savedSteps = new Map((progressResult.data ?? []).map((row) =>
    [row.module_id, readCompletedModuleStepIds(row.module_id, row.step_progress)]
  ))
  for (const group of groups) for (const lesson of group.modules) {
    lesson.completedStepIds = savedSteps.get(lesson.id) ?? []
  }

  const { totalModules, completedModules, inProgressModules, percent } =
    buildAcceleratorProgressTotals({
      moduleIds,
      progressStatusByModuleId,
      submissionByModuleId,
      assignmentByModuleId,
    })

  return { groups, totalModules, completedModules, inProgressModules, percent }
}
