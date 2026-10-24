import "server-only"
import { z } from "zod"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { resolveOrganizationDocumentStorageAccess } from "@/lib/organization/document-storage-access"
import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"
import type { KnowledgeKind, KnowledgeRecord } from "../research-types"
import type { ResearchContext } from "./research-context"

const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
const text = (value: unknown) => typeof value === "string" ? value : ""
const record = (id: string, kind: KnowledgeKind, title: string, content: string, revision: string | null, href = "/workspace", contentAvailable = true): KnowledgeRecord => ({ id, kind, title: title.slice(0,240), content: content.slice(0,20000), revision, href, contentAvailable })

/** Request-local adapters. No global private-data cache; every run uses actor RLS. */
export function knowledgeLoader(context: ResearchContext) {
  const { supabase, target, graph } = context
  let profileRead: Promise<{ profile: Record<string, unknown>; revision: string }> | undefined
  const profile = () => profileRead ??= (async () => {
    const { data, error } = await supabase.from("organizations").select("profile,updated_at").eq("user_id", target.organizationId).abortSignal(AbortSignal.timeout(10000)).single()
    if (error) throw new Error("Organization data is unavailable.")
    return { profile: z.record(z.string(),z.unknown()).parse(data.profile), revision: data.updated_at }
  })()
  return async (kind: KnowledgeKind, query: string): Promise<KnowledgeRecord[]> => {
    // PostgREST filters are values, not interpolated filter expressions.
    const pattern = `%${query.replace(/[%_\\]/g, " ").trim()}%`
    if (kind === "particle") return graph.particles.map(p => record(`particle:${p.id}`, kind, p.title,
      plain([p.description, p.type === "activity" && p.data.widget?.kind === "notes" && p.data.widget.source.kind === "workspace" ? p.data.widget.source.content : "", p.type === "objective" ? JSON.stringify(p.data.planning?.plans ?? []) : ""].join(" ")), String(p.revision)))
    if (kind === "organization" || kind === "person" || kind === "document") {
      const result = await profile()
      if (kind === "organization") return [record(`organization:${target.organizationId}`, kind, text(result.profile.name) || "Organization", JSON.stringify(Object.fromEntries(["name", "mission", "vision", "description", "city", "state", "website", "serviceArea", "programs"].flatMap(key => typeof result.profile[key] === "string" ? [[key,result.profile[key]]] : []))), result.revision)]
      if (kind === "person") return (Array.isArray(result.profile.org_people) ? result.profile.org_people : []).flatMap(raw => {
        const person = z.object({ id: z.uuid(), name: z.string(), title: z.string().nullish(), email: z.string().nullish(), phone: z.string().nullish(), notes: z.string().nullish() }).safeParse(raw)
        return person.success ? [record(`person:${person.data.id}`, kind, person.data.name, [person.data.title, person.data.email, person.data.phone, person.data.notes].filter(Boolean).join(" · "), result.revision, `/workspace?tab=people&focus=${person.data.id}`)] : []
      })
      const access = await resolveOrganizationDocumentStorageAccess({ supabase, orgId: target.organizationId })
      if ("error" in access) throw new Error(access.error)
      if (!access.hasStorageAccess) return []
      const core = resolveRoadmapSections(result.profile).filter(section => section.content.trim() && !section.driveSource).map(section => record(`document:${section.id}`, kind, section.title, plain(section.content), section.lastUpdated, getDocumentEditorHref(section.slug)))
      const { data, error } = await supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,updated_at")
        .eq("org_id",target.organizationId).is("deleted_at",null).is("document_kind",null).ilike("name",pattern).order("updated_at",{ascending:false}).limit(20).abortSignal(AbortSignal.timeout(10000))
      if (error) throw new Error("Documents could not be searched.")
      return [...core, ...(data ?? []).map(file => {
        const formats:Record<string,NonNullable<KnowledgeRecord["file"]>["format"]>={"application/pdf":"pdf","text/plain":"txt","text/markdown":"md","text/csv":"csv","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","application/msword":"doc"}
        const format=file.mime_type.startsWith("image/")?"image":formats[file.mime_type]
        return {...record(`file:${file.id}`,kind,file.name,`${file.mime_type}; ${file.size_bytes} bytes. File metadata only; contents have not been read.`,file.updated_at,`/workspace?tab=documents&focus=${file.id}`,false),...(format&&file.size_bytes>0&&file.size_bytes<=15728640?{file:{size:file.size_bytes,format}}:{})}
      })]
    }
    if (kind === "calendar") {
      const { data,error } = await supabase.from("roadmap_calendar_internal_events").select("id,title,description,starts_at,updated_at").eq("org_id",target.organizationId).ilike("title",pattern).order("starts_at",{ascending:true}).limit(20).abortSignal(AbortSignal.timeout(10000))
      if(error) throw new Error("Calendar could not be searched.")
      return (data ?? []).map(item => record(`calendar:${item.id}`,kind,item.title,`${item.starts_at} ${item.description ?? ""}`,item.updated_at,"/workspace?tab=calendar"))
    }
    const { data,error } = await supabase.from("organization_finance_opportunities").select("id,title,source_label,opportunity_type,due_at,status,updated_at,report").eq("org_id",target.organizationId).neq("status","dismissed").ilike("title",pattern).order("updated_at",{ascending:false}).limit(20).abortSignal(AbortSignal.timeout(10000))
    if(error) throw new Error("Opportunities could not be searched.")
    return (data ?? []).map(item => record(`opportunity:${item.id}`,kind,item.title,JSON.stringify({source:item.source_label,type:item.opportunity_type,dueAt:item.due_at,status:item.status,report:item.report}),item.updated_at))
  }
}
