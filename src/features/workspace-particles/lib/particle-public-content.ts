import { z } from "zod"
import { publishedFormDefinitionSchema } from "@/features/organization-forms"
import type { Particle, ParticleResult } from "../types"
import type { ActiveOrganization } from "@/lib/organization/active-org"

/** Mirrors the existing organization publication roles. Inputs must come from
 * the authenticated server actor; this predicate grants no source access. */
export function canManageParticlePublication(input: {
  activeOrganization: ActiveOrganization | null
  organizationId: string
  supportAccess: boolean
}) {
  const active = input.activeOrganization
  return Boolean(
    active &&
    !input.supportAccess &&
    z.uuid().safeParse(input.organizationId).success &&
    active.orgId === input.organizationId &&
    (active.role === "owner" ||
      active.role === "admin" ||
      active.role === "staff")
  )
}

const googleLink = z.url().refine((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    ["drive.google.com", "docs.google.com"].includes(url.hostname)
  )
}, "Use the canonical Google document link.")

/** Public DTO, deliberately independent of the board/domain payload. Every
 * object is strict: adding a private field fails instead of publishing it.
 * Asset IDs identify future explicit public grants, never private file paths.
 */
export const publicParticleContentSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(10_000).optional(),
  content: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("text") }),
    z.strictObject({
      kind: z.literal("notes"),
      markdown: z.string().max(20_000),
    }),
    z.strictObject({
      kind: z.literal("event"),
      startsAt: z.iso.datetime().nullable(),
      location: z.string().max(500).optional(),
    }),
    z.strictObject({
      kind: z.literal("color"),
      hex: z.string().regex(/^#[\da-f]{6}$/i),
    }),
    z.strictObject({
      kind: z.literal("form"),
      definition: publishedFormDefinitionSchema,
    }),
    z.strictObject({ kind: z.literal("drive_link"), href: googleLink }),
    z.strictObject({
      kind: z.literal("image"),
      assetId: z.uuid(),
      alt: z.string().max(1000),
    }),
    z.strictObject({
      kind: z.literal("document"),
      assetId: z.uuid(),
      name: z.string().min(1).max(1024),
    }),
  ]),
})
export type PublicParticleContent = z.infer<typeof publicParticleContentSchema>

/** Build an explicit review candidate from a saved, selected intrinsic card.
 * This is not publication authorization or a writer. The future Publish action
 * must authorize the actor, check the saved revision and commit the reviewed
 * projection. Markdown must use the existing sanitized renderer.
 * External sources require canonical resolution and (for bytes) a public grant.
 */
export function projectParticlePublicContent(
  particle: Particle
): ParticleResult<PublicParticleContent> {
  const base = {
    id: particle.id,
    title: particle.title,
    description: particle.description,
  }
  let content: PublicParticleContent["content"]
  if (particle.type === "objective" && !particle.data.source) {
    content = { kind: "text" }
  } else if (particle.type === "activity" && !particle.data.source) {
    const widget = particle.data.widget
    if (!widget) content = { kind: "text" }
    else if (widget.kind === "notes" && widget.source.kind === "workspace")
      content = { kind: "notes", markdown: widget.source.content }
    else if (widget.kind === "event")
      content = {
        kind: "event",
        startsAt: widget.startsAt,
        location: widget.location,
      }
    else if (widget.kind === "color")
      content = { kind: "color", hex: widget.hex }
    else if (widget.kind === "form")
      content = { kind: "form", definition: widget.definition }
    else
      return {
        ok: false,
        code: "unsupported",
        error:
          "This Particle requires an authorized public source preview before sharing.",
      }
  } else
    return {
      ok: false,
      code: "unsupported",
      error: "This Particle does not have a public preview yet.",
    }
  const parsed = publicParticleContentSchema.safeParse({ ...base, content })
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        code: "invalid",
        error: "Complete this Particle before sharing it.",
      }
}
