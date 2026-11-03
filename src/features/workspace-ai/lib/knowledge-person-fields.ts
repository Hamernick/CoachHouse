import { z } from "zod"
import { knowledgePersonFieldSchema } from "@/lib/workspace/research-source-schema"
export { knowledgePersonFieldSchema, knowledgePersonFieldsSchema } from "@/lib/workspace/research-source-schema"
export type KnowledgePersonField = z.infer<typeof knowledgePersonFieldSchema>
export const knowledgePersonFieldLabels: Record<KnowledgePersonField, string> = { title: "Role", email: "Email", phone: "Phone", notes: "Notes", "details.organization": "Organization", "details.location": "Location", "details.website": "Website", "details.timezone": "Time zone", "details.relationshipStage": "Relationship stage", "details.followUpDate": "Follow-up date" }
export type KnowledgePersonData = {
  values: Partial<Record<KnowledgePersonField, string | null>>;
  sources: Partial<Record<KnowledgePersonField, { kind: string; label: string; recordedAt: string; verification: "unverified" }>>;
}
