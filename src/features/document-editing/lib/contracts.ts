import { z } from "zod"

// Start conservatively; complete content is rejected, never truncated.
export const DOCUMENT_EDIT_BYTES = 1024 * 1024
export const documentSourceSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("coach_house"), organizationId: z.uuid(), fileId: z.uuid() }).strict(),
  z.object({ provider: z.literal("google_drive"), organizationId: z.uuid(), attachmentId: z.uuid() }).strict(),
])
export const documentSnapshotSchema = z.object({
  source: documentSourceSchema,
  name: z.string().min(1).max(1024),
  format: z.literal("markdown"),
  revision: z.string().min(1).max(256),
  updatedAt: z.iso.datetime({ offset: true }),
  content: z.string().refine((text) => new TextEncoder().encode(text).length <= DOCUMENT_EDIT_BYTES, "This file exceeds the current editing limit."),
  // A preview/read capability cannot accidentally authorize a whole-file writer.
  collaboration: z.discriminatedUnion("state", [
    z.object({ state: z.literal("unavailable"), canCommit: z.literal(false) }).strict(),
    z.object({ state: z.literal("ready"), canCommit: z.boolean(), roomId: z.string().min(1).max(256), checkpoint: z.string().min(1).max(256) }).strict(),
  ]),
}).strict()

export function decodeCompleteDocument(bytes: Uint8Array) {
  if (bytes.byteLength > DOCUMENT_EDIT_BYTES) throw new Error("This file exceeds the current editing limit.")
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error("This file is not valid UTF-8. The original is unchanged.")
  }
}
