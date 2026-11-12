import { readOrganizationProfileForProjection } from "@/lib/organization/profile-read"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"
import "server-only"
import { createHash } from "node:crypto"
import { inaccessibleParticleDocuments } from "@/lib/organization/particle-document-audience"
import { planKnowledgeRecords, teamKnowledgeRecords } from "./knowledge-context-records"
import { knowledgePersonData } from "./knowledge-person"
import { contactDetailsSchema, contactMetadataSchema, isActiveContact } from "@/lib/people/contact-schema"
import { z } from "zod"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { resolveOrganizationDocumentStorageAccess } from "@/lib/organization/document-storage-access"
import { filterDocumentFileAudience } from "@/lib/organization/document-file-audience"
import { filterAiDocumentCopies, projectReadableDocumentProfile } from "@/lib/organization/document-ai-copies"
import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"
import type { Particle } from "@/features/workspace-particles"
import type { KnowledgeKind, KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"
import { retainedParticleFiles } from "@/lib/organization/particle-ai-origins"
import { inaccessibleNativeFiles, nativeFilesForRecords, particleNativeFileDependencies } from "@/lib/organization/particle-file-dependencies"

import { NATIVE_DOCUMENT_READER_CHARACTERS } from "@/lib/workspace/research-source-schema"
import { nativeDocumentText } from "./document-passages"

const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
const text = (value: unknown) => typeof value === "string" ? value : ""
const record = (id: string, kind: KnowledgeKind, title: string, content: string, revision: string | null, href = "/workspace", contentAvailable = true): KnowledgeRecord => {
  const native = id.startsWith("document:")
  let end = Math.min(content.length, native ? NATIVE_DOCUMENT_READER_CHARACTERS : 20000)
  if (native && end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1])) end--
  return { id, kind, title: title.slice(0,240), content: content.slice(0,end), revision, href, contentAvailable,
    contentTruncated: content.length > end, ...(native ? { nativeTextLength: content.length,
      nativeTextHash: createHash("sha256").update(content).digest("hex") } : {}) }
}

/** A reference selects an existing authorized reader; it never supplies authority. */
export async function readKnowledgeRecord(load: ReturnType<typeof knowledgeLoader>, id: string) {
  const separator = id.indexOf(":")
  if (separator < 1 || separator === id.length - 1) return undefined
  const kinds: Record<string, KnowledgeKind> = { organization: "organization", person: "person", document: "document", file: "document", particle: "particle", calendar: "calendar", opportunity: "opportunity" }
  const prefix = id.slice(0, separator)
  if (!Object.hasOwn(kinds, prefix)) return undefined
  const kind = kinds[prefix]
  return (await load(kind, "", id)).find(item => item.id === id && item.kind === kind)
}

export function particleKnowledgeRecord(particle: Particle): KnowledgeRecord {
  return record(`particle:${particle.id}`, "particle", particle.title,
    plain([particle.description, particle.type === "activity" && particle.data.widget?.kind === "notes" && particle.data.widget.source.kind === "workspace" ? particle.data.widget.source.content : "",
      particle.type === "objective" ? JSON.stringify(particle.data.planning?.plans ?? []) : "",
      particle.type === "decision" ? JSON.stringify(particle.data) : ""].join(" ")), String(particle.revision))
}

export type UploadedKnowledgePosition = { updatedAt: string; id: string }
export type UploadedKnowledgePage = { after?: UploadedKnowledgePosition; next: (position: UploadedKnowledgePosition | null) => void }

/** Request-local adapters. No global private-data cache; every run uses actor RLS. */
export function knowledgeLoader(context: ResearchContext) {
  const { supabase, target, graph } = context
  let profileRead: Promise<{ profile: Record<string, unknown>; revision: string }> | undefined
  const profile = () => profileRead ??= (async () => {
    const { data, error } = await readOrganizationProfileForProjection(supabase, target.organizationId, context.user.id, AbortSignal.timeout(10000))
    if (error || !data) throw new Error("Organization data is unavailable.")
    return { profile: z.record(z.string(),z.unknown()).parse(data.profile), revision: data.updated_at }
  })()
  return async (kind: KnowledgeKind, query: string, exactId?: string, page?: UploadedKnowledgePage): Promise<KnowledgeRecord[]> => {
    // PostgREST filters are values, not interpolated filter expressions.
    const pattern = `%${query.replace(/[%_\\]/g, " ").trim()}%`
    if (kind === "particle") {
      const current = particleNativeFileDependencies(graph)
      const retained = await retainedParticleFiles(target.organizationId, context.user.id, current.keys())
      const dependencies = particleNativeFileDependencies(graph, retained)
      const records = [...graph.particles.map(particleKnowledgeRecord), ...planKnowledgeRecords(context, Boolean(exactId))]
        .filter(item => !exactId || item.id === exactId)
      const denied = await inaccessibleNativeFiles(nativeFilesForRecords(dependencies, records.map(item => item.id)), context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })
      const deniedDocuments = await inaccessibleParticleDocuments(graph, context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })
      return records.filter(item => !deniedDocuments.has(item.id) && ![...(dependencies.get(item.id) ?? [])].some(id => denied.has(id)))
        .map(item => {
          const nativeFileIds = nativeFilesForRecords(dependencies, [item.id])
          return nativeFileIds.length ? { ...item, nativeFileIds } : item
        })
    }
    if (kind === "person" && exactId?.startsWith("person:team:")) return teamKnowledgeRecords(context)
    if (kind === "organization" || kind === "person" || kind === "document") {
      const result = await profile()
      if (kind === "organization") {
        const { profile: readable } = await projectReadableDocumentProfile(result.profile, target.organizationId, context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })
        return [record(`organization:${target.organizationId}`, kind, text(readable.name) || "Organization", JSON.stringify(Object.fromEntries(["name", "mission", "vision", "description", "city", "state", "website", "serviceArea", "programs"].flatMap(key => typeof readable[key] === "string" ? [[key,readable[key]]] : []))), result.revision)]
      }
      if (kind === "person") return (Array.isArray(result.profile.org_people) ? result.profile.org_people : []).filter(isActiveContact).flatMap(raw => {
        const person = z.object({ id: z.uuid(), name: z.string(), image: z.string().nullish(), title: z.string().nullish(), email: z.string().nullish(), phone: z.string().nullish(), notes: z.string().nullish(), details: contactDetailsSchema.optional(), contactMetadata: contactMetadataSchema.optional() }).safeParse(raw)
        return person.success ? [{...record(`person:${person.data.id}`, kind, person.data.name, JSON.stringify({ title: person.data.title, email: person.data.email, phone: person.data.phone, notes: person.data.notes, details: person.data.details, sources: Object.fromEntries(Object.entries(person.data.contactMetadata?.provenance ?? {}).map(([field, source]) => [field, { kind: source.kind, label: source.label, recordedAt: source.recordedAt, verification: source.verification }])) }), result.revision, `/workspace?tab=people&focus=${person.data.id}`), searchContent: person.data.title ?? "", avatarSource: person.data.image ?? undefined, personData: knowledgePersonData(person.data)}] : []
      })
      const access = await resolveOrganizationDocumentStorageAccess({ supabase, orgId: target.organizationId })
      if ("error" in access) throw new Error(access.error)
      if (!access.hasStorageAccess) return []
      const sections = page ? [] : resolveRoadmapSections(result.profile).filter(section => section.content.trim() && resolveCoreDocumentSource(section) === "editor" && (!exactId || exactId === `document:${section.id}`))
      const core = (await filterAiDocumentCopies(sections, target.organizationId, context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })).map(section => {
        const native = nativeDocumentText(section.content)
        return { ...record(`document:${section.id}`, kind, section.title, native.content, section.lastUpdated, getDocumentEditorHref(section.slug)), nativeParagraphs: native.nativeParagraphs }
      })
      if (exactId && !exactId.startsWith("file:")) return core.filter(item => item.id === exactId)
      const files = supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,updated_at")
        .eq("org_id",target.organizationId).is("deleted_at",null).is("document_kind",null)
      let selection = exactId ? files.eq("id",exactId.slice(5)) : files.ilike("name",pattern)
      if (page?.after) {
        // Only canonical, validated server positions reach this filter expression.
        const id = z.uuid().parse(page.after.id), updatedAt = z.iso.datetime({offset:true}).parse(page.after.updatedAt)
        selection = selection.or(`updated_at.lt.${updatedAt},and(updated_at.eq.${updatedAt},id.lt.${id})`)
      }
      const { data, error } = await selection.order("updated_at",{ascending:false}).order("id",{ascending:false})
        .limit(exactId ? 1 : 20).abortSignal(AbortSignal.timeout(10000))
      if (error) throw new Error("Documents could not be searched.")
      const last = data?.at(-1)
      page?.next(data?.length === 20 && last ? {updatedAt:last.updated_at,id:last.id} : null)
      const readable = await filterDocumentFileAudience(data ?? [], context.user.id, { organizationId: context.target.organizationId, canvasId: context.canvasId })
      return [...core, ...readable.map(file => {
        const formats:Record<string,NonNullable<KnowledgeRecord["file"]>["format"]>={"application/pdf":"pdf","text/plain":"txt","text/markdown":"md","text/csv":"csv","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","application/msword":"doc"}
        const format=file.mime_type.startsWith("image/")?"image":formats[file.mime_type]
        return {...record(`file:${file.id}`,kind,file.name,`${file.mime_type}; ${file.size_bytes} bytes. File metadata only; contents have not been read.`,file.updated_at,`/workspace?tab=documents&focus=${file.id}`,false),...(format&&file.size_bytes>0&&file.size_bytes<=15728640?{file:{size:file.size_bytes,format}}:{})}
      })]
    }
    if (kind === "calendar") {
      const events = supabase.from("roadmap_calendar_internal_events").select("id,title,description,starts_at,updated_at").eq("org_id",target.organizationId)
      const { data,error } = await (exactId ? events.eq("id",exactId.slice(9)) : events.ilike("title",pattern)).order("starts_at",{ascending:true}).limit(exactId ? 1 : 20).abortSignal(AbortSignal.timeout(10000))
      if(error) throw new Error("Calendar could not be searched.")
      return (data ?? []).map(item => record(`calendar:${item.id}`,kind,item.title,`${item.starts_at} ${item.description ?? ""}`,item.updated_at,"/workspace?tab=calendar"))
    }
    const opportunities = supabase.from("organization_finance_opportunities").select("id,title,source_label,opportunity_type,due_at,status,updated_at,report").eq("org_id",target.organizationId).neq("status","dismissed")
    const { data,error } = await (exactId ? opportunities.eq("id",exactId.slice(12)) : opportunities.ilike("title",pattern)).order("updated_at",{ascending:false}).limit(exactId ? 1 : 20).abortSignal(AbortSignal.timeout(10000))
    if(error) throw new Error("Opportunities could not be searched.")
    return (data ?? []).map(item => record(`opportunity:${item.id}`,kind,item.title,JSON.stringify({source:item.source_label,type:item.opportunity_type,dueAt:item.due_at,status:item.status,report:item.report}),item.updated_at))
  }
}
