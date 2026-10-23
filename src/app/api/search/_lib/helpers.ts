import type { SearchResult } from "@/lib/search/types"
import type { SearchRow } from "./types"

export const MIN_QUERY_LENGTH = 2
export const MAX_RESULTS = 30
const SESSION_TITLE_PATTERNS = [
  /^session\s+\d+\s*[\u2013-]\s*/i,
  /^session\s+[a-z]\d+\s*[\u2013-]\s*/i,
]

export const DOCUMENT_LABELS: Record<string, string> = {
  verificationLetter: "501(c)(3) determination letter",
  articlesOfIncorporation: "Articles of incorporation",
  bylaws: "Bylaws",
  stateRegistration: "State registration",
  goodStandingCertificate: "Certificate of good standing",
  w9: "W-9 form",
  taxExemptCertificate: "Tax exempt certificate",
}

export function formatClassTitle(title: string) {
  const match = title.match(/^Session\s+[A-Za-z]\d+\s*[\u2013-]\s*(.+)$/i)
  if (match) return match[1].trim()
  return title
}

export function normalizeQuery(query: string) {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

export function matchesQuery(
  values: Array<string | null | undefined>,
  tokens: string[],
) {
  if (tokens.length === 0) return false
  const haystack = values.filter(Boolean).join(" ").toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function extractProfileValue(profile: Record<string, unknown>, key: string) {
  const value = profile[key]
  if (typeof value === "string") return value
  return ""
}

function isSessionTitle(title: string) {
  return SESSION_TITLE_PATTERNS.some((pattern) => pattern.test(title))
}

function extractClassSlug(href: string) {
  const match = href.match(/\/accelerator\/class\/([^/]+)/)
  return match?.[1] ?? null
}

export function shouldOmitSearchRow(row: SearchRow) {
  const classSlug = extractClassSlug(row.href)
  if (classSlug && /^session-e\d+/i.test(classSlug)) return true

  if (row.group_name === "Classes") {
    return isSessionTitle(row.label)
  }

  if (row.group_name === "Modules") {
    return row.subtitle ? isSessionTitle(row.subtitle) : false
  }

  if (row.group_name === "Questions") {
    const classTitle = row.subtitle?.split(" · ")[0] ?? ""
    return isSessionTitle(classTitle)
  }

  return false
}

export function formatSearchRow(row: SearchRow): SearchResult {
  let label = row.label
  let subtitle = row.subtitle ?? undefined

  if (row.group_name === "Classes") {
    label = formatClassTitle(row.label)
  }

  if (row.group_name === "Modules" && subtitle) {
    subtitle = formatClassTitle(subtitle)
  }

  if (row.group_name === "Questions" && subtitle?.includes(" · ")) {
    const [classTitle, moduleTitle] = subtitle.split(" · ")
    subtitle = moduleTitle
      ? `${formatClassTitle(classTitle)} · ${moduleTitle}`
      : subtitle
  }

  return {
    id: row.id,
    label,
    subtitle,
    href: row.href,
    group: row.group_name,
  }
}
