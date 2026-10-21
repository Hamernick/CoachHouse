import { calculateParticleExpression } from "./particle-calculation"
import { formDefinitionSchema } from "@/features/organization-forms"
import { z } from "zod"

const identifier = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[\w-]+$/)
const googleDriveLink = z.url().refine((value) => {
  const url = new URL(value)
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    ["drive.google.com", "docs.google.com"].includes(url.hostname)
  )
}, "Use a Google Drive document link.")

export const particleDocumentSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("upload"), documentKind: identifier }),
  z.strictObject({ kind: z.literal("policy"), id: identifier }),
  z.strictObject({ kind: z.literal("roadmap"), sectionId: identifier }),
  z.strictObject({
    kind: z.literal("roadmap_drive"),
    sectionId: identifier,
    fileId: identifier,
    webViewLink: googleDriveLink,
  }),
  z.strictObject({ kind: z.literal("workspace_note"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("module_note"), moduleId: identifier }),
  z.strictObject({
    kind: z.literal("drive"),
    id: identifier,
    webViewLink: googleDriveLink,
  }),
])

export const particleWidgetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("form"), definition: formDefinitionSchema }),
  z.strictObject({
    kind: z.literal("notes"),
    source: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("workspace"),
        content: z.string().max(20_000),
        html: z.string().max(120_000).optional(),
        contentEditedAt: z.iso.datetime().optional(),
      }),
      z.strictObject({ kind: z.literal("module"), moduleId: identifier }),
    ]),
  }),
  z.strictObject({ kind: z.literal("image_placeholder") }),
  z
    .strictObject({
      kind: z.literal("document"),
      fileId: z.uuid().optional(),
      source: particleDocumentSourceSchema.optional(),
      format: z.enum([
        "pdf",
        "md",
        "docx",
        "doc",
        "csv",
        "txt",
        "image",
        "link",
        "roadmap",
      ]),
      name: z.string().min(1).max(1024),
      size: z
        .number()
        .int()
        .min(1)
        .max(15 * 1024 * 1024)
        .optional(),
    })
    .refine(
      (file) => Boolean(file.fileId) !== Boolean(file.source),
      "Choose one document source."
    )
    .refine(
      (file) => !file.fileId || file.size !== undefined,
      "File size is required."
    ),
  z.strictObject({
    kind: z.literal("image"),
    fileId: z.uuid(),
    width: z.number().int().min(1).max(20000),
    height: z.number().int().min(1).max(20000),
    alt: z.string().max(1000),
  }),
  z.strictObject({
    kind: z.literal("event"),
    startsAt: z.iso.datetime().nullable(),
    location: z.string().trim().max(500).optional(),
    attendees: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  }),
  z.strictObject({
    kind: z.literal("timer"),
    seconds: z.number().int().min(1).max(86400),
    remainingSeconds: z.number().int().min(0).max(86400).optional(),
    endsAt: z.iso.datetime().nullable(),
  }),
  z.strictObject({
    kind: z.literal("split"),
    total: z.number().finite().min(0).max(1e12),
    people: z.number().int().min(1).max(10000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  z.strictObject({
    kind: z.literal("color"),
    hex: z.string().regex(/^#[\da-f]{6}$/i),
  }),
  z
    .strictObject({
      kind: z.literal("calculate"),
      expression: z.string().min(1).max(240),
      result: z.number().finite(),
    })
    .refine((widget) => {
      try {
        return calculateParticleExpression(widget.expression) === widget.result
      } catch {
        return false
      }
    }, "Enter a valid calculation."),
])
