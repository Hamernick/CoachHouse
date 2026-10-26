import { createHash } from "node:crypto"
import { ORGANIZATION_CORE_DOCUMENT_SECTION_IDS, resolveOrganizationCoreDocuments, type OrganizationCoreDocumentKey } from "@/lib/roadmap/organization-core-documents"
import { organizationNarrativeHtmlToPlainText } from "@/lib/roadmap/organization-narratives"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import type { LiveCompanionContext } from "../../types"
import { CompanionError } from "../errors"
import { checkLiveRead, companionLiveRpc, requireLiveOrganization, liveAppUrl } from "./accelerator-access"
import { liveInvalid, livePlainText, liveRecord } from "./accelerator-answers"

const titles: Record<OrganizationCoreDocumentKey, string> = { originStory: "Origin story", need: "Need statement", mission: "Mission statement", vision: "Vision", values: "Values", theoryOfChange: "Theory of change" }
export function liveDocumentKey(value: string | undefined): OrganizationCoreDocumentKey {
  const key = value ?? "mission"
  if (!Object.hasOwn(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS, key)) return liveInvalid("Choose a supported organization document.")
  return key as OrganizationCoreDocumentKey
}
function stable(value: unknown): string {
  if (!value || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`
}
export async function readLiveDocument(context: LiveCompanionContext, organizationId: string, key: OrganizationCoreDocumentKey) {
  const { data, error } = await context.supabase.from("organizations").select("profile, updated_at").eq("user_id", organizationId).maybeSingle()
  checkLiveRead(error)
  if (!data) throw new CompanionError("forbidden", 403, "This organization is unavailable.")
  const profile = liveRecord(data.profile)
  const revision = createHash("sha256").update(stable({ profile, updatedAt: data.updated_at })).digest("hex")
  const section = resolveRoadmapSections(profile).find(item => item.id === ORGANIZATION_CORE_DOCUMENT_SECTION_IDS[key])
  const destination = section ? `/workspace/roadmap/${encodeURIComponent(section.slug)}` : "/workspace/roadmap"
  return { profile, updatedAt: data.updated_at, document: { id: key, title: titles[key], content: organizationNarrativeHtmlToPlainText(resolveOrganizationCoreDocuments(profile)[key]), revision, visibility: "organization" as const, href: liveAppUrl(context, destination) } }
}
export async function saveLiveDocument(context: LiveCompanionContext, input: { organizationId: string; documentId?: string; content?: string; expectedRevision?: number | string; requestId?: string; confirmed?: boolean }) {
  await requireLiveOrganization(context, input.organizationId, true)
  if (input.confirmed !== true) throw new CompanionError("confirmation_required", 400, "Approve the exact reviewed document text before saving.")
  const key = liveDocumentKey(input.documentId)
  const current = await readLiveDocument(context, input.organizationId, key)
  const content = livePlainText(input.content)
  if (!content) liveInvalid("The proposed document cannot be empty.")
  // Check idempotency before rejecting a retry against the now-advanced revision.
  const retry = await companionLiveRpc<{ applied: boolean } | null>(context, "companion_document_retry", { p_client_id: context.clientId, p_org_id: input.organizationId, p_document_id: key, p_request_id: input.requestId, p_revision: input.expectedRevision, p_content: content })
  if (retry?.applied) return "This document change was already saved."
  if (input.expectedRevision !== current.document.revision) throw new CompanionError("revision_conflict", 409, "This document changed. Reload and review before saving.")
  // The database derives the sole target-section delta and publication preservation.
  await companionLiveRpc(context, "companion_save_document", { p_client_id: context.clientId, p_org_id: input.organizationId, p_document_id: key, p_request_id: input.requestId, p_revision: input.expectedRevision, p_content: content, p_expected_profile: current.profile, p_expected_updated_at: current.updatedAt, p_confirmed: true })
  return "Organization document draft saved. The previously published version was preserved."
}
