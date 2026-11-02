import "server-only"
import { createHash } from "node:crypto"
import type { ContactDetails, ContactMetadata } from "@/lib/people/contact-schema"
import { knowledgePersonFieldSchema, knowledgePersonFieldsSchema, type KnowledgePersonData, type KnowledgePersonField } from "../lib/knowledge-person-fields"
import type { KnowledgeRecord } from "../research-types"

/** Internal canonical projection only; never spread this object into tool output. */
export function knowledgePersonData(person: { title?: string | null; email?: string | null; phone?: string | null; notes?: string | null; details?: ContactDetails; contactMetadata?: ContactMetadata }): KnowledgePersonData {
  const values: KnowledgePersonData["values"] = {}, sources: KnowledgePersonData["sources"] = {}
  for (const field of knowledgePersonFieldSchema.options) {
    const value = field.startsWith("details.") ? person.details?.[field.slice(8) as keyof ContactDetails] : person[field as "title" | "email" | "phone" | "notes"]
    values[field] = typeof value === "string" ? value : null
    const source = person.contactMetadata?.provenance?.[field as keyof NonNullable<ContactMetadata["provenance"]>]
    if (source) sources[field] = { kind: source.kind, label: source.label, recordedAt: source.recordedAt, verification: source.verification }
  }
  return { values, sources }
}
export function knowledgePersonFieldFingerprint(record: KnowledgeRecord, field: KnowledgePersonField) {
  if (record.kind !== "person" || !record.personData) throw new Error("Contact fields are unavailable.")
  return createHash("sha256").update(JSON.stringify({ field, value: record.personData.values[field] ?? null, source: record.personData.sources[field] ?? null })).digest("hex")
}
export function projectKnowledgePerson(record: KnowledgeRecord, input: KnowledgePersonField[] | null | undefined): KnowledgeRecord {
  if (record.kind !== "person") return record
  if (!record.personData) throw new Error("Contact fields are unavailable.")
  const fields = knowledgePersonFieldsSchema.parse(input ?? ["title"]).sort()
  const content = JSON.stringify({ fields: Object.fromEntries(fields.map(field => [field, record.personData!.values[field] ?? null])),
    sources: Object.fromEntries(fields.flatMap(field => record.personData!.sources[field] ? [[field, record.personData!.sources[field]]] : [])) })
  return { ...record, content: content.slice(0, 20000), contentAvailable: true, contentTruncated: content.length > 20000, contactFields: fields }
}
