import { z } from "zod"
import { stripHtml } from "@/lib/markdown/convert"
import { officialOpportunityNoticeSchema, type OfficialOpportunityNotice } from "../matching-types"

export const GRANTS_GOV_DETAIL_ENDPOINT = "https://api.grants.gov/v1/api/fetchOpportunity"
const publishedText = (value: string) => stripHtml(value).replace(/&(rsquo|lsquo|rdquo|ldquo|ndash|mdash|hellip);/g, (_, name: string) => ({rsquo:"’",lsquo:"‘",rdquo:"”",ldquo:"“",ndash:"–",mdash:"—",hellip:"…"})[name] ?? "")
const text = z.string().max(100_000).nullish()
const amount = z.union([z.string().max(30), z.number().finite().nonnegative()]).nullish()
const summarySchema = z.object({
  opportunityId: z.number().int().positive(), version: z.number().int().nonnegative().optional(),
  agencyName: text, agencyCode: text, agencyDetails: z.object({ agencyName: text }).nullish(),
  synopsisDesc: text, forecastDesc: text, applicantEligibilityDesc: text,
  fundingDescLinkUrl: text,
  costSharing: z.boolean().nullish(), estimatedFunding: amount, awardCeiling: amount, awardFloor: amount,
  applicantTypes: z.array(z.object({ id: z.string().min(1).max(20), description: z.string().min(1).max(1000) })).max(30).optional(),
  postingDate: text, postingDateStr: text, lastUpdatedDate: text,
  responseDate: text, responseDateStr: text, responseDateDesc: text,
  estApplicationResponseDate: text, estApplicationResponseDateStr: text, estApplicationResponseDateDesc: text,
})
const responseSchema = z.object({ errorcode: z.literal(0), data: z.object({
  id: z.number().int().positive(), revision: z.number().int().nonnegative().optional(),
  opportunityTitle: z.string().min(1).max(2000), docType: z.enum(["synopsis", "forecast"]),
  ost: z.string().max(40).optional(), listed: z.string().max(10).optional(),
  synopsis: summarySchema.nullish(), forecast: summarySchema.nullish(),
}) })

/** Decimal dollars become integer cents without floating-point multiplication. */
function cents(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(String(value).trim())
  if (!match) throw new Error("Invalid published amount.")
  const integer = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"))
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Published amount exceeds precision limits.")
  return Number(integer)
}
function dateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const numeric = /^(\d{4})-(\d{2})-(\d{2})(?:-\d{2}-\d{2}-\d{2})?$/.exec(value)
  const named = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})(?: \d{2}:\d{2}:\d{2} [AP]M (?:EST|EDT))?$/.exec(value)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const year = Number(numeric?.[1] ?? named?.[3]), month = numeric ? Number(numeric[2]) : months.indexOf(named?.[1] ?? "") + 1, day = Number(numeric?.[3] ?? named?.[2])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if ((!numeric && !named) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error("Invalid published date.")
  return parsed.toISOString().slice(0, 10)
}

/** Values are source facts, never proof that a particular organization is eligible. */
export function normalizeGrantsGovDetail(value: unknown, externalId: string, observedAt: string): OfficialOpportunityNotice {
  const verifiedAt = z.iso.datetime().parse(observedAt), response = responseSchema.parse(value), data = response.data
  if (!/^\d{1,12}$/.test(externalId) || String(data.id) !== externalId) throw new Error("Opportunity identity mismatch.")
  const source = data[data.docType]
  if (!source || source.opportunityId !== data.id) throw new Error("Opportunity detail is unavailable.")
  const originalUrl = `https://www.grants.gov/search-results-detail/${externalId}`
  const evidence: OfficialOpportunityNotice["evidence"] = []
  const remember = <T>(field: string, path: string, item: T): T => {
    if (item !== null && item !== undefined && item !== "") evidence.push({ field, path, url: originalUrl, verifiedAt })
    return item
  }
  const path = `data.${data.docType}`
  const readDate = (field: string, first: keyof typeof source, fallback?: keyof typeof source) => {
    const key = source[first] ? first : fallback ?? first
    return remember(field, `${path}.${key}`, dateOnly(source[key] as string | null | undefined))
  }
  const rawStatus = data.ost?.toLowerCase()
  const status = data.listed && data.listed !== "L" ? "withdrawn" : (["posted", "forecasted", "closed", "archived", "withdrawn"].includes(rawStatus ?? "") ? rawStatus : "unknown") as OfficialOpportunityNotice["status"]
  const floor = remember("awardFloorCents", `${path}.awardFloor`, cents(source.awardFloor))
  const ceiling = remember("awardCeilingCents", `${path}.awardCeiling`, cents(source.awardCeiling))
  const pool = remember("fundingPoolCents", `${path}.estimatedFunding`, cents(source.estimatedFunding))
  if (floor !== null && ceiling !== null && floor > ceiling) throw new Error("Published award range is inconsistent.")
  const forecast = data.docType === "forecast"
  return officialOpportunityNoticeSchema.parse({
    provider: "grants_gov", externalId, originalUrl,
    title: remember("title", "data.opportunityTitle", publishedText(data.opportunityTitle)),
    agency: publishedText(source.agencyDetails?.agencyName || source.agencyName || source.agencyCode || "Grants.gov"),
    status: remember("status", data.listed && data.listed !== "L" ? "data.listed" : "data.ost", status),
    summary: remember("summary", `${path}.${forecast ? "forecastDesc" : "synopsisDesc"}`, publishedText((forecast ? source.forecastDesc : source.synopsisDesc) ?? "")),
    awardFloorCents: floor, awardCeilingCents: ceiling, fundingPoolCents: pool, currency: "USD", awardPeriod: null,
    valueKind: [floor, ceiling, pool].some(item => item !== null) ? "cash" : "not_published", inKind: null,
    applicantTypes: remember("applicantTypes", `${path}.applicantTypes`, source.applicantTypes ?? []),
    eligibilityText: remember("eligibilityText", `${path}.applicantEligibilityDesc`, publishedText(source.applicantEligibilityDesc ?? "")),
    costSharing: remember("costSharing", `${path}.costSharing`, source.costSharing ?? null), costShareRateBps: null, costShareBasis: null,
    postedDate: readDate("postedDate", "postingDateStr", "postingDate"), updatedDate: readDate("updatedDate", "lastUpdatedDate"),
    deadlineDate: readDate("deadlineDate", forecast ? "estApplicationResponseDateStr" : "responseDateStr", forecast ? "estApplicationResponseDate" : "responseDate"),
    deadlineTimezone: null, deadlineDescription: (forecast ? source.estApplicationResponseDateDesc : source.responseDateDesc) || null,
    discoveredAt: verifiedAt, verifiedAt, evidence, sourceRevision: `${data.revision ?? "unknown"}:${source.version ?? "unknown"}:${source.lastUpdatedDate ?? "unknown"}`,
    applicationSourceUrl: remember("applicationSourceUrl", `${path}.fundingDescLinkUrl`, z.url({ protocol: /^https?$/ }).max(2000).safeParse(source.fundingDescLinkUrl).data ?? null),
  })
}
