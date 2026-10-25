import { notePreview } from "@/lib/modules/note-content"
import { z } from "zod"
import type { Particle } from "../types"
import { createParticle } from "./particle-registry"
import { particleSchema } from "./particle-schema"

export { NOTES_CHANGED_EVENT } from "@/lib/modules/notes-events"
export const noteDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  updatedAt: z.string(),
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("workspace_note"), id: z.uuid() }),
    z.strictObject({
      kind: z.literal("module_note"),
      moduleId: z
        .string()
        .min(1)
        .max(240)
        .regex(/^[\w-]+$/),
    }),
  ]),
})
export type NoteDocument = z.infer<typeof noteDocumentSchema>

export function getParticleNotes(particle: Particle) {
  return particle.type === "activity" && particle.data.widget?.kind === "notes"
    ? particle.data.widget.source
    : null
}

/** A matching creation ID is not confirmation of a subsequently edited body. */
export function workspaceNoteContentDiffers(left: Particle, right: Particle) {
  const leftNote = getParticleNotes(left), rightNote = getParticleNotes(right)
  return leftNote?.kind === "workspace" && rightNote?.kind === "workspace" &&
    (leftNote.content !== rightNote.content || leftNote.html !== rightNote.html)
}
export function moduleNotesParticle(input: {
  workspaceId: string
  id: string
  now: string
  moduleId: string
  title: string
}) {
  const particle = createParticle("activity", input)
  if (particle.type !== "activity") throw new Error("Invalid Notes Particle.")
  return particleSchema.parse({
    ...particle,
    size: "large",
    data: {
      ...particle.data,
      widget: {
        kind: "notes",
        source: { kind: "module", moduleId: input.moduleId },
      },
    },
  })
}
export function workspaceNoteDocuments(
  particles: readonly Particle[]
): NoteDocument[] {
  return particles.flatMap((particle) => {
    const note = getParticleNotes(particle)
    if (note?.kind !== "workspace") return []
    return [
      {
        id: `workspace-note:${particle.id}`,
        ...notePreview(note.content),
        updatedAt: note.contentEditedAt ?? particle.updatedAt,
        source: { kind: "workspace_note", id: particle.id },
      } satisfies NoteDocument,
    ]
  })
}
