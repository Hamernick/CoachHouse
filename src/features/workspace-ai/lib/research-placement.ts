import { z } from "zod"

/** A placement preference, never a client-supplied graph or authority. */
export const researchPlacementSchema = z.strictObject({
  x: z.number().finite().min(-900_000).max(900_000),
  y: z.number().finite().min(-900_000).max(900_000),
})
export type ResearchPlacement = z.infer<typeof researchPlacementSchema>
