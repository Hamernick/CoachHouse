import { z } from "zod"
import { PERSON_CATEGORY_META } from "./categories"

const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]*$/, "Remove control characters.")
const optionalText = (max: number) => shortText(max).optional()
export const CONTACT_DETAIL_FIELDS = {
  organization: { label: "Organization", type: "text" },
  location: { label: "Location", type: "text" },
  website: { label: "Website", type: "url" },
  timezone: { label: "Timezone", type: "text" },
  relationshipStage: { label: "Relationship stage", type: "select" },
  followUpDate: { label: "Next follow-up", type: "date" },
} as const
export const CONTACT_STAGES = ["New", "Contacted", "Active", "Paused"] as const
export const contactDetailsSchema = z
  .object({
    organization: optionalText(200),
    location: optionalText(200),
    website: z
      .union([z.literal(""), z.url({ protocol: /^https?$/ }).max(2048)])
      .optional(),
    timezone: shortText(100)
      .refine((value) => {
        if (!value) return true
        try {
          new Intl.DateTimeFormat("en", { timeZone: value })
          return true
        } catch {
          return false
        }
      }, "Use a valid timezone, such as America/Chicago.")
      .meta({ format: "iana-timezone" })
      .optional(),
    relationshipStage: z
      .union([z.literal(""), z.enum(CONTACT_STAGES)])
      .optional(),
    followUpDate: z.union([z.literal(""), z.iso.date()]).optional(),
  })
  .strict()
export type ContactDetails = z.infer<typeof contactDetailsSchema>
export type ContactDetailField = keyof ContactDetails
export const CONTACT_VALUE_FIELDS = [
  "name",
  "title",
  "email",
  "phone",
  "details.organization",
  "details.location",
  "details.website",
  "details.timezone",
  "details.relationshipStage",
  "details.followUpDate",
] as const
export type ContactValueField = (typeof CONTACT_VALUE_FIELDS)[number]
export const contactSourceSchema = z
  .object({
    kind: z.enum(["manual", "csv", "vcf", "paste"]),
    label: shortText(160),
    recordedAt: z.iso.datetime(),
    recordedBy: shortText(128),
    batchId: z.uuid().optional(),
    verification: z.literal("unverified"),
  })
  .strict()
export type ContactSource = z.infer<typeof contactSourceSchema>
export const contactMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
    createdAt: z.iso.datetime().optional(),
    archivedAt: z.iso.datetime().optional(),
    provenance: z.partialRecord(
      z.enum(CONTACT_VALUE_FIELDS),
      contactSourceSchema
    ),
  })
  .strict()
export type ContactMetadata = z.infer<typeof contactMetadataSchema>
export const contactCoreSchema = z
  .object({
    name: shortText(200).min(1, "Name is required."),
    title: shortText(200),
    email: z.union([z.literal(""), z.email().max(254)]),
    phone: shortText(64),
    details: contactDetailsSchema.optional(),
  })
  .strict()
// Legacy records may omit metadata. Writers attach v1 metadata without inventing old sources.
export const contactRecordSchema = z
  .object({
    id: shortText(2048).min(1),
    name: contactCoreSchema.shape.name,
    title: shortText(200).nullish(),
    email: z.union([z.literal(""), z.email().max(254)]).nullish(),
    phone: shortText(64).nullish(),
    category: z.enum(
      Object.keys(PERSON_CATEGORY_META) as [
        keyof typeof PERSON_CATEGORY_META,
        ...Array<keyof typeof PERSON_CATEGORY_META>,
      ]
    ),
    customRole: shortText(60).nullish(),
    image: shortText(4096).nullish(),
    reportsToId: shortText(2048).nullish(),
    pos: z.object({ x: z.number().finite(), y: z.number().finite() }).nullish(),
    tags: z.array(shortText(100)).max(100).optional(),
    linkedin: shortText(2048).nullish(),
    instagram: shortText(2048).nullish(),
    facebook: shortText(2048).nullish(),
    twitter: shortText(2048).nullish(),
    youtube: shortText(2048).nullish(),
    tiktok: shortText(2048).nullish(),
    details: contactDetailsSchema.optional(),
    contactMetadata: contactMetadataSchema.optional(),
  })
  .strict()
export type ContactRecord = z.infer<typeof contactRecordSchema>
export function contactJsonSchema() {
  return {
    ...z.toJSONSchema(contactRecordSchema),
    $id: "urn:coach-house:contact:v1",
    title: "Coach House contact v1",
  }
}
export function isActiveContact(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const metadata = (value as { contactMetadata?: ContactMetadata })
    .contactMetadata
  return !metadata?.archivedAt
}
