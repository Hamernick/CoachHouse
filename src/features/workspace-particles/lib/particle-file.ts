import { z } from "zod"
import { MAX_BYTES, MAX_UPLOAD_MB } from "@/lib/organization/document-storage"
import { createParticle } from "./particle-registry"
import {
  PARTICLE_IMAGE_ACCEPT,
  particleImageFileError,
  uploadParticleImage,
  imageFileEndpoint,
  readImageResponse,
} from "./particle-image"
import type { Particle, ParticlePosition } from "../types"

export type ParticleDocument = Extract<
  NonNullable<Extract<Particle, { type: "activity" }>["data"]["widget"]>,
  { kind: "document" }
>
export const PARTICLE_FILE_ACCEPT = `${PARTICLE_IMAGE_ACCEPT},.pdf,.md,.markdown,.docx,.doc,.csv,.txt`
const formats = z.enum(["pdf", "md", "docx", "doc", "csv", "txt"])
export function particleFileFormat(name: string) {
  const extension = name.split(".").pop()?.toLowerCase()
  const parsed = formats.safeParse(extension === "markdown" ? "md" : extension)
  return parsed.success ? parsed.data : null
}
export function getParticleDocument(particle: Particle) {
  return particle.type === "activity" &&
    particle.data.widget?.kind === "document"
    ? particle.data.widget
    : null
}
/** Only canonical uploaded Markdown has a complete-content editor adapter.
 * Drive/roadmap/module notes retain their existing owners and permissions. */
export function particleFileEditingSource(particle: Particle) {
  const file = getParticleDocument(particle)
  return file?.format === "md" && file.fileId
    ? { provider: "coach_house" as const, organizationId: particle.workspaceId, fileId: file.fileId }
    : null
}
export function particleFileError(file: Pick<File, "name" | "type" | "size">) {
  if (PARTICLE_IMAGE_ACCEPT.split(",").includes(file.type))
    return particleImageFileError(file)
  if (!particleFileFormat(file.name))
    return "Choose an image, PDF, Markdown, Word, CSV or text file."
  if (!file.size) return "This file is empty."
  if (file.size > MAX_BYTES) return `Files must be ${MAX_UPLOAD_MB} MB or less.`
  return null
}
export async function uploadParticleFile(workspaceId: string, file: File) {
  const error = particleFileError(file)
  if (error) throw new Error(error)
  if (PARTICLE_IMAGE_ACCEPT.split(",").includes(file.type))
    return uploadParticleImage(workspaceId, file)
  const format = particleFileFormat(file.name)
  if (!format) throw new Error("Unsupported file format.")
  const form = new FormData()
  form.set("file", file)
  const response = await fetch(imageFileEndpoint(workspaceId), {
    method: "POST",
    body: form,
  })
  const result = z
    .object({ file: z.object({ id: z.uuid() }) })
    .parse(await readImageResponse(response))
  return {
    kind: "document",
    format,
    fileId: result.file.id,
    name: file.name,
    size: file.size,
  } satisfies ParticleDocument
}
export function createFileParticle(
  workspaceId: string,
  title: string,
  file: Awaited<ReturnType<typeof uploadParticleFile>>,
  position: ParticlePosition,
  id: string,
  now: string
): Particle {
  const particle = createParticle("activity", { workspaceId, title, id, now })
  if (particle.type !== "activity")
    throw new Error("Invalid file Particle type.")
  return {
    ...particle,
    size: "large",
    position,
    positionMode: "manual",
    data: { ...particle.data, widget: file },
  }
}
