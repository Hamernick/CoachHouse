import { z } from "zod"

const nullableText = z.string().nullable()
const basis = z.enum(["source_reported", "provider_confirmed"]).nullable()
export const directoryItemSchema = z
  .object({
    ein: z.string().regex(/^\d{9}$/),
    name: z.string().min(1).max(300),
    city: nullableText,
    state: nullableText,
    postalCode: nullableText,
    website: z
      .string()
      .url()
      .regex(/^https?:\/\//)
      .nullable(),
    phone: nullableText,
    description: z.string().max(1000).nullable(),
    websiteBasis: basis,
    phoneBasis: basis,
    websiteSourcePeriod: nullableText,
    phoneSourcePeriod: nullableText,
    descriptionSourcePeriod: nullableText,
    operatingStatus: z.literal("unknown"),
    listingType: z.literal("nonprofit_organization"),
  })
  .strict()

