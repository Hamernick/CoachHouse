import { stripHtml } from "@/lib/markdown/convert"
import { isDocumentsSectionVisible } from "@/lib/organization/core-document-uploads"
import { hasMeaningfulRoadmapBudgetRows } from "@/lib/roadmap/budget"
import type { RoadmapSection } from "@/lib/roadmap"

import type { OrgDocuments, OrgProgram } from "../../types"
import type {
  DocumentsOption,
  DocumentsPolicyEntry,
  DocumentsRoadmapSection,
  DocumentsTabProps,
} from "./types"

export type DocumentsTabData = Omit<
  DocumentsTabProps,
  "userId" | "organizationId" | "editMode" | "canEdit"
>

const POLICY_STATUSES = new Set(["not_started", "in_progress", "complete"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const output: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const category = entry.trim()
    if (!category) continue
    const key = category.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(category)
  }
  return output
}

export function buildDocumentsTabDocuments(
  profile: Record<string, unknown>
): OrgDocuments {
  const documentsRaw = isRecord(profile.documents)
    ? (profile.documents as Record<string, unknown>)
    : null

  const parseDocument = (key: keyof OrgDocuments) => {
    const raw =
      documentsRaw && isRecord(documentsRaw[key])
        ? (documentsRaw[key] as Record<string, unknown>)
        : null
    // The full-account seed stores example references, not uploaded files.
    if (
      !raw ||
      typeof raw.path !== "string" ||
      !raw.path.trim() ||
      raw.path.startsWith("seed/")
    ) return null
    return {
      name: String(raw.name ?? ""),
      path: raw.path,
      size: typeof raw.size === "number" ? raw.size : null,
      mime: typeof raw.mime === "string" ? raw.mime : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    }
  }

  return {
    verificationLetter: parseDocument("verificationLetter"),
    articlesOfIncorporation: parseDocument("articlesOfIncorporation"),
    bylaws: parseDocument("bylaws"),
    stateRegistration: parseDocument("stateRegistration"),
    goodStandingCertificate: parseDocument("goodStandingCertificate"),
    w9: parseDocument("w9"),
    taxExemptCertificate: parseDocument("taxExemptCertificate"),
    ueiConfirmation: parseDocument("ueiConfirmation"),
    samActiveStatus: parseDocument("samActiveStatus"),
    grantsGovRegistration: parseDocument("grantsGovRegistration"),
    gataPreQualification: parseDocument("gataPreQualification"),
    einConfirmationLetter: parseDocument("einConfirmationLetter"),
    irs990s: parseDocument("irs990s"),
    auditedFinancials: parseDocument("auditedFinancials"),
  }
}

export function buildDocumentsPolicyEntries(
  profile: Record<string, unknown>
): DocumentsPolicyEntry[] {
  const policiesRaw = Array.isArray(profile.policies)
    ? (profile.policies as Array<unknown>)
    : []

  return policiesRaw
    .map((entry) => (isRecord(entry) ? entry : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const statusRaw =
        typeof entry.status === "string" ? entry.status.trim() : ""
      const personIdsRaw = Array.isArray(entry.personIds)
        ? (entry.personIds as unknown[])
        : []
      const categories = normalizeCategories(entry.categories)
      if (categories.length === 0 && Boolean(entry.board)) {
        categories.push("Board")
      }
      const rawDocument = isRecord(entry.document)
        ? (entry.document as Record<string, unknown>)
        : null

      return {
        id: typeof entry.id === "string" ? entry.id : "",
        title: typeof entry.title === "string" ? entry.title : "",
        summary: typeof entry.summary === "string" ? entry.summary : "",
        status: POLICY_STATUSES.has(statusRaw)
          ? (statusRaw as DocumentsPolicyEntry["status"])
          : "not_started",
        categories,
        programId: typeof entry.programId === "string" ? entry.programId : null,
        personIds: personIdsRaw.filter(
          (value): value is string => typeof value === "string"
        ),
        document:
          rawDocument &&
          typeof rawDocument.path === "string" &&
          rawDocument.path.length > 0
            ? {
                name:
                  typeof rawDocument.name === "string" ? rawDocument.name : "",
                path: rawDocument.path,
                size:
                  typeof rawDocument.size === "number"
                    ? rawDocument.size
                    : null,
                mime:
                  typeof rawDocument.mime === "string"
                    ? rawDocument.mime
                    : null,
                updatedAt:
                  typeof rawDocument.updatedAt === "string"
                    ? rawDocument.updatedAt
                    : null,
              }
            : null,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : null,
      }
    })
    .filter(
      (entry) => entry.id.trim().length > 0 && entry.title.trim().length > 0
    )
}

export function buildDocumentsPolicyProgramOptions(
  programs: Array<Pick<OrgProgram, "id" | "title">>
): DocumentsOption[] {
  return programs.map((program) => ({
    id: program.id,
    label:
      typeof program.title === "string" && program.title.trim().length > 0
        ? program.title
        : "Untitled resource",
  }))
}

export function buildDocumentsPolicyPeopleOptions(
  profile: Record<string, unknown>
): DocumentsOption[] {
  return (
    Array.isArray(profile.org_people)
      ? (profile.org_people as Array<unknown>)
      : []
  )
    .map((entry) => (isRecord(entry) ? entry : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      label:
        typeof entry.name === "string" && entry.name.trim().length > 0
          ? entry.name
          : "Unnamed person",
    }))
    .filter((entry) => entry.id.trim().length > 0)
}

export function buildDocumentsRoadmapSections({
  canAccessRoadmapDocuments,
  roadmapSections,
}: {
  canAccessRoadmapDocuments: boolean
  roadmapSections: RoadmapSection[]
}): DocumentsRoadmapSection[] {
  if (!canAccessRoadmapDocuments) return []

  return roadmapSections
    .filter((section) => isDocumentsSectionVisible(section.id))
    .map((section) => ({
      content: section.content,
      driveSource: section.driveSource,
      documentSource: section.documentSource,
      hasContent:
        Boolean(
          stripHtml(section.content).trim() || /<img\b/i.test(section.content)
        ) || hasMeaningfulRoadmapBudgetRows(section.budgetRows ?? []),
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      slug: section.slug,
      status: section.status,
      lastUpdated: section.lastUpdated,
      isPublic: section.isPublic,
    }))
}

export function buildDocumentsTabData({
  canAccessRoadmapDocuments,
  profile,
  programs,
  publicSlug,
  roadmapSections,
}: {
  canAccessRoadmapDocuments: boolean
  profile: Record<string, unknown>
  programs: Array<Pick<OrgProgram, "id" | "title">>
  publicSlug: string | null
  roadmapSections: RoadmapSection[]
}): DocumentsTabData {
  return {
    documents: buildDocumentsTabDocuments(profile),
    policyEntries: buildDocumentsPolicyEntries(profile),
    policyProgramOptions: buildDocumentsPolicyProgramOptions(programs),
    policyPeopleOptions: buildDocumentsPolicyPeopleOptions(profile),
    roadmapSections: buildDocumentsRoadmapSections({
      canAccessRoadmapDocuments,
      roadmapSections,
    }),
    publicSlug,
  }
}
