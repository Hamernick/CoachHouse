import type { OrgPerson } from "@/actions/people"
import {
  CONTACT_VALUE_FIELDS,
  contactMetadataSchema,
  type ContactSource,
  type ContactValueField,
} from "./contact-schema"

export function contactValue(
  person: Partial<OrgPerson> | null | undefined,
  field: ContactValueField
): string | null {
  if (!person) return null
  if (field.startsWith("details."))
    return (
      person.details?.[
        field.slice(8) as keyof NonNullable<OrgPerson["details"]>
      ] ?? null
    )
  return person[field as "name" | "email" | "phone" | "title"] ?? null
}
export function stampContactChange(
  before: OrgPerson | null | undefined,
  after: OrgPerson,
  source: ContactSource
): OrgPerson {
  const prior = contactMetadataSchema.safeParse(before?.contactMetadata)
  const provenance = { ...(prior.success ? prior.data.provenance : {}) }
  for (const field of CONTACT_VALUE_FIELDS) {
    if (contactValue(before, field) !== contactValue(after, field))
      provenance[field] = source
  }
  return {
    ...after,
    contactMetadata: {
      ...(prior.success ? prior.data : {}),
      schemaVersion: 1,
      revision: (prior.success ? prior.data.revision : 0) + 1,
      ...(!before ? { createdAt: source.recordedAt } : {}),
      updatedAt: source.recordedAt,
      archivedAt: after.contactMetadata?.archivedAt,
      provenance,
    },
  }
}
export function stableContactJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableContactJson).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableContactJson(item)}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "null"
}
