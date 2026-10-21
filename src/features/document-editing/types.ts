import type { z } from "zod"
import type { documentSourceSchema, documentSnapshotSchema } from "./lib/contracts"

export type DocumentSource = z.infer<typeof documentSourceSchema>
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>
export type DocumentEditingInput = { source: DocumentSource }
