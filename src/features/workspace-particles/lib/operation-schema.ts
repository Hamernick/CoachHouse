import { z } from "zod"
import {
  particleConnectionSchema,
  particleIdSchema,
  particlePositionSchema,
  particleRevisionSchema,
  particleSchema,
} from "./particle-schema"

const expected = particleRevisionSchema.nullable()
export const particleOperationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("put_particle"),
    particle: particleSchema,
    expectedRevision: expected,
  }),
  z.strictObject({
    kind: z.literal("remove_particle"),
    id: particleIdSchema,
    expectedRevision: particleRevisionSchema,
  }),
  z.strictObject({
    kind: z.literal("put_connection"),
    connection: particleConnectionSchema,
    expectedRevision: expected,
  }),
  z.strictObject({
    kind: z.literal("remove_connection"),
    id: particleIdSchema,
    expectedRevision: particleRevisionSchema,
  }),
  z.strictObject({
    kind: z.literal("move_particles"),
    mode: z.enum(["manual", "managed"]),
    positions: z
      .array(
        z.strictObject({
          id: particleIdSchema,
          expectedRevision: particleRevisionSchema,
          position: particlePositionSchema,
        })
      )
      .min(1)
      .max(250),
  }),
  z.strictObject({
    kind: z.literal("set_root"),
    expectedId: particleIdSchema.nullable(),
    id: particleIdSchema.nullable(),
  }),
])
export const particleBatchSchema = z.strictObject({
  id: particleIdSchema,
  workspaceId: particleIdSchema,
  baseRevision: particleRevisionSchema,
  requireExactRevision: z.boolean().default(false),
  operations: z.array(particleOperationSchema).min(1).max(1000),
})
export async function fingerprintParticleBatch(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(value))
  if (encoded.byteLength > 512_000)
    throw new Error("Particle operation exceeds the size limit.")
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}
