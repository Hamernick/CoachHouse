import { z } from "zod"

const text = (max: number) => z.string().trim().max(max).refine((value) => !/[<>]/.test(value), "Use plain text without HTML.")
export const guestProfileFieldsSchema = z.object({
  name: text(200).min(1), description: text(6000),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]), phone: text(200),
}).partial().strict()
export const guestProfileRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("preview"), reference: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("open"), reference: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("save"), reference: z.string().uuid(), requestId: z.string().uuid(),
    version: z.string().regex(/^[a-f0-9]{32}$/), fields: guestProfileFieldsSchema }).strict(),
])
const displayedFields = z.object({ name: z.string(), description: z.string(), email: z.string(), phone: z.string() }).strict()
export const guestProfilePreviewSchema = z.object({ state: z.literal("preview"), version: z.string(), isPublic: z.boolean(),
  current: displayedFields, suggestions: displayedFields }).strict()
export type GuestProfilePreview = z.infer<typeof guestProfilePreviewSchema>
export type GuestProfileFields = z.infer<typeof displayedFields>
export const guestProfileHref = (reference: string) => `/documentation/fiscal-sponsorship/profile?application=${encodeURIComponent(reference)}`
