import { z } from "zod"
export const knowledgePersonFieldSchema = z.enum(["title", "email", "phone", "notes", "details.organization", "details.location", "details.website", "details.timezone", "details.relationshipStage", "details.followUpDate"])
export const knowledgePersonFieldsSchema = z.array(knowledgePersonFieldSchema).min(1).max(10).refine(fields => new Set(fields).size === fields.length, "Choose distinct contact fields")
export type KnowledgePersonField = z.infer<typeof knowledgePersonFieldSchema>
export const knowledgePersonFieldLabels: Record<KnowledgePersonField, string> = { title: "Role", email: "Email", phone: "Phone", notes: "Notes", "details.organization": "Organization", "details.location": "Location", "details.website": "Website", "details.timezone": "Time zone", "details.relationshipStage": "Relationship stage", "details.followUpDate": "Follow-up date" }
export type KnowledgePersonData = {
  values: Partial<Record<KnowledgePersonField, string | null>>;
  sources: Partial<Record<KnowledgePersonField, { kind: string; label: string; recordedAt: string; verification: "unverified" }>>;
}
