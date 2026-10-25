import { z } from "zod"
import { documentSnapshotSchema } from "./contracts"
import { roomSchema } from "./room-contracts"

/** Read-only capability. No bootstrap, recovery replay or write authority. */
export const documentWindowSchema = z.object({
  viewerId: z.uuid(),
  snapshot: documentSnapshotSchema,
  shared: z.discriminatedUnion("state", [
    z.object({ state: z.literal("absent") }).strict(),
    z.object({ state: z.literal("unavailable") }).strict(),
    z.object({ state: z.literal("ready"), room: roomSchema }).strict(),
  ]),
}).strict().superRefine((value, context) => {
  if (value.shared.state !== "ready") return
  const { source, updatedAt } = value.snapshot
  const { room } = value.shared
  if (source.provider !== "coach_house" || room.org_id !== source.organizationId ||
      room.file_id !== source.fileId || Date.parse(room.base_updated_at) !== Date.parse(updatedAt)) {
    context.addIssue({ code: "custom", message: "The shared session belongs to another file revision." })
  }
})

export type DocumentWindowView = z.infer<typeof documentWindowSchema>
