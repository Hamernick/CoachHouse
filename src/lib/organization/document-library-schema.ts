import { z } from "zod"
import { DOCUMENTS } from "./core-document-definitions"

const documentSchema = z.object({ name: z.string(), path: z.string(), size: z.number().nullable().optional(), mime: z.string().nullable().optional(), updatedAt: z.string().nullable().optional() })
const optionSchema = z.object({ id: z.string(), label: z.string() })
const statusSchema = z.enum(["not_started", "in_progress", "complete"])

export const profileDocumentLibrarySchema = z.object({
  userId: z.string().uuid(), organizationId: z.string().uuid(), canEdit: z.boolean(),
  documents: z.object(Object.fromEntries(DOCUMENTS.map(item => [item.key, documentSchema.nullable().optional()]))),
  policyEntries: z.array(z.object({
    id: z.string(), title: z.string(), summary: z.string(), status: statusSchema,
    categories: z.array(z.string()), programId: z.string().nullable(), personIds: z.array(z.string()),
    document: documentSchema.nullable(), updatedAt: z.string().nullable(),
  })),
  policyProgramOptions: z.array(optionSchema), policyPeopleOptions: z.array(optionSchema),
  roadmapSections: z.array(z.object({
    id: z.string(), title: z.string(), subtitle: z.string(), slug: z.string(), status: statusSchema,
    content: z.string().optional(), hasContent: z.boolean().optional(), lastUpdated: z.string().nullable(), isPublic: z.boolean(),
    documentSource: z.enum(["editor", "google_drive"]).optional(),
    driveSource: z.object({ provider: z.literal("google_drive"), fileId: z.string(), name: z.string(), webViewLink: z.string() }).nullable().optional(),
  })),
  publicSlug: z.string().nullable(),
})
