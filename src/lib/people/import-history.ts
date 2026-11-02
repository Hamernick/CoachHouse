import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import type { OrgPerson } from "@/actions/people"
import {
  CONTACT_VALUE_FIELDS,
  contactSourceSchema,
  type ContactSource,
  type ContactValueField,
} from "./contact-schema"
import {
  contactValue,
  stableContactJson,
  stampContactChange,
} from "./contact-provenance"

const changedFieldSchema = z
  .object({
    field: z.enum(CONTACT_VALUE_FIELDS),
    before: z.string().max(2048).nullable(),
    after: z.string().max(2048).nullable(),
    sourceBefore: contactSourceSchema.optional(),
  })
  .strict()
const changeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("created"),
      personId: z.string().max(2048),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("filled"),
      personId: z.string().max(2048),
      fields: z.array(changedFieldSchema).max(10),
    })
    .strict(),
])
export const peopleImportBatchSchema = z
  .object({
    id: z.uuid(),
    actorId: z.string(),
    createdAt: z.iso.datetime(),
    label: z.string().max(160),
    kind: z.enum(["csv", "vcf", "paste"]),
    changes: z.array(changeSchema).max(500),
    added: z.number().int().nonnegative(),
    filled: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    undoneAt: z.iso.datetime().optional(),
  })
  .strict()
export type PeopleImportBatch = z.infer<typeof peopleImportBatchSchema>
export type PeopleImportSummary = Pick<
  PeopleImportBatch,
  "id" | "label" | "kind" | "createdAt" | "added" | "filled" | "undoneAt"
>
export const PEOPLE_IMPORT_UNDO_DAYS = 7
export function readPeopleImportHistory(value: unknown): PeopleImportBatch[] {
  if (!Array.isArray(value)) return []
  return value.slice(-5).flatMap((entry) => {
    const parsed = peopleImportBatchSchema.safeParse(entry)
    return parsed.success ? [parsed.data] : []
  })
}
export function retainPeopleImportHistory(
  history: PeopleImportBatch[],
  now: string
) {
  const cutoff = Date.parse(now) - PEOPLE_IMPORT_UNDO_DAYS * 86400000
  const recent = history
    .filter((item) => Date.parse(item.createdAt) >= cutoff)
    .slice(-5)
  while (
    recent.length > 1 &&
    Buffer.byteLength(JSON.stringify(recent)) > 1_000_000
  )
    recent.shift()
  if (Buffer.byteLength(JSON.stringify(recent)) > 1_000_000)
    throw new Error(
      "This import is too large to save safely. Split it into smaller files."
    )
  return recent
}
const fingerprint = (person: OrgPerson) =>
  createHash("sha256").update(stableContactJson(person)).digest("hex")
export function recordPeopleImport(
  before: OrgPerson[],
  after: OrgPerson[],
  source: ContactSource
) {
  const prior = new Map(before.map((person) => [person.id, person]))
  const changes: PeopleImportBatch["changes"] = []
  const people = after.map((person) => {
    const previous = prior.get(person.id)
    if (previous && stableContactJson(previous) === stableContactJson(person))
      return person
    const next = stampContactChange(previous, person, source)
    if (!previous || previous.contactMetadata?.archivedAt)
      changes.push({
        kind: "created",
        personId: next.id,
        fingerprint: fingerprint(next),
      })
    else
      changes.push({
        kind: "filled",
        personId: next.id,
        fields: CONTACT_VALUE_FIELDS.filter(
          (field) => contactValue(previous, field) !== contactValue(next, field)
        ).map((field) => ({
          field,
          before: contactValue(previous, field),
          after: contactValue(next, field),
          ...(previous.contactMetadata?.provenance[field]
            ? { sourceBefore: previous.contactMetadata.provenance[field] }
            : {}),
        })),
      })
    return next
  })
  return { people, changes }
}
function restoreField(
  person: OrgPerson,
  field: ContactValueField,
  value: string | null
) {
  if (field.startsWith("details.")) {
    const key = field.slice(8) as keyof NonNullable<OrgPerson["details"]>
    person.details = { ...person.details }
    if (value === null) delete person.details[key]
    else Object.assign(person.details, { [key]: value })
  } else Object.assign(person, { [field]: value })
}
export function undoPeopleImport(
  people: OrgPerson[],
  batch: PeopleImportBatch,
  now: string
) {
  let archived = 0,
    restored = 0,
    protectedCount = 0
  const changes = new Map(
    batch.changes.map((change) => [change.personId, change])
  )
  if (batch.undoneAt) return { people, archived, restored, protectedCount }
  const next = people.map((person) => {
    const change = changes.get(person.id)
    if (!change) return person
    if (change.kind === "created") {
      if (
        fingerprint(person) !== change.fingerprint ||
        !person.contactMetadata
      ) {
        protectedCount++
        return person
      }
      archived++
      return {
        ...person,
        contactMetadata: {
          ...person.contactMetadata,
          archivedAt: now,
          updatedAt: now,
          revision: person.contactMetadata.revision + 1,
        },
      }
    }
    const metadata = person.contactMetadata
    if (!metadata) {
      protectedCount += change.fields.length
      return person
    }
    const next = {
      ...person,
      contactMetadata: { ...metadata, provenance: { ...metadata.provenance } },
    }
    let changed = false
    for (const field of change.fields) {
      if (
        contactValue(person, field.field) !== field.after ||
        metadata.provenance[field.field]?.batchId !== batch.id
      ) {
        protectedCount++
        continue
      }
      restoreField(next, field.field, field.before)
      if (field.sourceBefore)
        next.contactMetadata.provenance[field.field] = field.sourceBefore
      else delete next.contactMetadata.provenance[field.field]
      changed = true
      restored++
    }
    if (!changed) return person
    next.contactMetadata.updatedAt = now
    next.contactMetadata.revision++
    return next
  })
  return { people: next, archived, restored, protectedCount }
}
