import { z } from "zod"

export const formResponseDirectorySchema = z.strictObject({
  forms: z.array(z.strictObject({ formId: z.uuid(), versionId: z.uuid(), title: z.string().max(240) })).max(50),
  next: z.uuid().nullable(),
})
