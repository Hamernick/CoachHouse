import { normalizeEin } from "@/lib/organization/ein"
import type { ModuleCardStatus } from "@/lib/accelerator/progress"
import {
  resolveOrganizationNarrativePlainText,
  type RoadmapSection,
} from "@/lib/roadmap"

export const ACCELERATOR_FUNDABLE_THRESHOLD = 70
export const ACCELERATOR_VERIFIED_THRESHOLD = 90

const CORE_FORMATION_MODULE_SLUGS = new Set(["naming-your-nfp", "nfp-registration", "filing-1023"])
export const CORE_ROADMAP_SECTION_IDS = new Set([
  "origin_story",
  "need",
  "mission_vision_values",
  "theory_of_change",
  "program",
])
export const PROFILE_COMPLETENESS_KEYS = [
  "name",
  "tagline",
  "mission",
  "need",
  "values",
  "address_city",
  "address_state",
] as const
export const VERIFIED_DOC_KEYS = [
  "verificationLetter",
  "bylaws",
  "stateRegistration",
  "goodStandingCertificate",
  "w9",
] as const

type ReadinessModule = {
  slug: string
  status: ModuleCardStatus
}

type ReadinessProgram = {
  goal_cents: number | null
}

type ReadinessInput = {
  profile: Record<string, unknown>
  modules: ReadinessModule[]
  roadmapSections: RoadmapSection[]
  programs: ReadinessProgram[]
  peopleCount: number
}

export type AcceleratorReadinessChecklistItem = {
  id: string
  label: string
  complete: boolean
}

export type AcceleratorReadinessSummary = {
  score: number
  progressPercent: number
  fundableCheckpoint: number
  verifiedCheckpoint: number
  fundable: boolean
  verified: boolean
  fundableChecklist: AcceleratorReadinessChecklistItem[]
  verifiedChecklist: AcceleratorReadinessChecklistItem[]
  fundableMissing: string[]
  verifiedMissing: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function hasUploadedDocument(documents: Record<string, unknown>, key: string) {
  const raw = documents[key]
  if (!isRecord(raw)) return false
  return hasText(raw.path)
}

function isSectionComplete(section: RoadmapSection) {
  if (section.status === "complete") return true
  if (section.content.trim().length > 0) return true
  return false
}

export function resolveAcceleratorReadiness({
  profile,
  modules,
  roadmapSections,
  programs,
  peopleCount,
}: ReadinessInput): AcceleratorReadinessSummary {
  const moduleStatusBySlug = new Map(modules.map((module) => [module.slug.trim().toLowerCase(), module.status]))
  const coreLessonsCompleted = Array.from(CORE_FORMATION_MODULE_SLUGS).filter(
    (slug) => moduleStatusBySlug.get(slug) === "completed",
  ).length
  const coreLessonsComplete = coreLessonsCompleted === CORE_FORMATION_MODULE_SLUGS.size

  const documents = isRecord(profile.documents) ? profile.documents : {}
  const hasVerificationLetter = hasUploadedDocument(documents, "verificationLetter")
  const hasArticles = hasUploadedDocument(documents, "articlesOfIncorporation")

  const hasProgram = programs.length > 0
  const hasFundingGoal = programs.some((program) => Number(program.goal_cents ?? 0) > 0)

  const profileFieldsCompleted = PROFILE_COMPLETENESS_KEYS.filter((key) => {
    if (key === "mission" || key === "values") {
      return hasText(resolveOrganizationNarrativePlainText(profile, key))
    }
    return hasText(profile[key])
  }).length
  const profileScore = Math.round((profileFieldsCompleted / PROFILE_COMPLETENESS_KEYS.length) * 20)

  const roadmapCoreCompleted = roadmapSections.filter(
    (section) => CORE_ROADMAP_SECTION_IDS.has(section.id) && isSectionComplete(section),
  ).length
  const roadmapScore = Math.round((roadmapCoreCompleted / CORE_ROADMAP_SECTION_IDS.size) * 30)

  const formationScore = Math.round((coreLessonsCompleted / CORE_FORMATION_MODULE_SLUGS.size) * 25)
  const programScore = hasFundingGoal ? 15 : hasProgram ? 8 : 0
  const teamScore = peopleCount >= 1 ? 10 : 0

  const fundableScore = clamp(profileScore + roadmapScore + formationScore + programScore + teamScore, 0, 100)
  const fundableHardRequirements = coreLessonsComplete && hasFundingGoal && (hasVerificationLetter || hasArticles)
  const fundable =
    fundableHardRequirements &&
    fundableScore >= ACCELERATOR_FUNDABLE_THRESHOLD

  const formationStatus = String(profile.formationStatus ?? "").trim().toLowerCase()
  const hasEin = Boolean(normalizeEin(profile.ein))
  const verified = hasEin && formationStatus === "approved"

  const score = verified
    ? 100
    : fundable
      ? Math.max(fundableScore, ACCELERATOR_FUNDABLE_THRESHOLD)
      : fundableScore
  const progressPercent = verified
    ? 100
    : fundable
      ? clamp(
          score,
          ACCELERATOR_FUNDABLE_THRESHOLD,
          ACCELERATOR_VERIFIED_THRESHOLD - 1,
        )
      : clamp(score, 0, ACCELERATOR_FUNDABLE_THRESHOLD - 1)

  const fundableChecklist: AcceleratorReadinessChecklistItem[] = [
    {
      id: "formation-lessons",
      label: "Complete the Formation class",
      complete: coreLessonsComplete,
    },
    {
      id: "program-funding-goal",
      label: "Set a program funding goal",
      complete: hasFundingGoal,
    },
    {
      id: "legal-formation-document",
      label: "Upload legal formation document",
      complete: hasVerificationLetter || hasArticles,
    },
  ]

  const verifiedChecklist: AcceleratorReadinessChecklistItem[] = [
    {
      id: "ein",
      label: "Add an EIN",
      complete: hasEin,
    },
    {
      id: "approved-formation-status",
      label: "Confirm 501(c)(3) status",
      complete: formationStatus === "approved",
    },
  ]

  const fundableMissing = fundableChecklist
    .filter((item) => !item.complete)
    .map((item) => item.label)

  const verifiedMissing = verifiedChecklist
    .filter((item) => !item.complete)
    .map((item) => item.label)

  return {
    score,
    progressPercent,
    fundableCheckpoint: ACCELERATOR_FUNDABLE_THRESHOLD,
    verifiedCheckpoint: ACCELERATOR_VERIFIED_THRESHOLD,
    fundable,
    verified,
    fundableChecklist,
    verifiedChecklist,
    fundableMissing,
    verifiedMissing,
  }
}
