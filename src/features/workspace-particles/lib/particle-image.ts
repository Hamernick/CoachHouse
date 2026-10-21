import { z } from "zod"
import { MAX_BYTES, MAX_UPLOAD_MB } from "@/lib/organization/document-storage"
import { createParticle } from "./particle-registry"
import type { Particle, ParticlePosition } from "../types"

export const PARTICLE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
export const MAX_PARTICLE_IMAGES = 8
export type ParticleImage = Extract<
  NonNullable<Extract<Particle, { type: "activity" }>["data"]["widget"]>,
  { kind: "image" }
>
export function isImagePlaceholder(particle: Particle) {
  return (
    particle.type === "activity" &&
    particle.data.widget?.kind === "image_placeholder"
  )
}
export function getParticleImage(particle: Particle): ParticleImage | null {
  return particle.type === "activity" && particle.data.widget?.kind === "image"
    ? particle.data.widget
    : null
}
export function particleImageFileError(file: Pick<File, "type" | "size">) {
  if (!PARTICLE_IMAGE_ACCEPT.split(",").includes(file.type))
    return "Choose a JPEG, PNG, WebP or GIF image."
  if (!file.size) return "This image is empty."
  if (file.size > MAX_BYTES)
    return `Images must be ${MAX_UPLOAD_MB} MB or less.`
  return null
}
export function imageFileTitle(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .trim()
      .slice(0, 240) || "Image"
  )
}
export function imageFileEndpoint(workspaceId: string, fileId?: string) {
  return `/api/account/organization-document-files?${new URLSearchParams({ organizationId: workspaceId, ...(fileId ? { id: fileId } : {}) })}`
}
export async function readImageResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body)
    throw new Error(
      error.success ? error.data.error : "Unable to load this image."
    )
  }
  return body
}
export async function uploadParticleImage(
  workspaceId: string,
  file: File
): Promise<ParticleImage> {
  const error = particleImageFileError(file)
  if (error) throw new Error(error)
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file)
      const image = new Image()
      const finish = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      }
      const timer = setTimeout(() => {
        finish()
        reject(new Error("This image could not be decoded."))
      }, 15000)
      image.onload = () => {
        const width = image.naturalWidth,
          height = image.naturalHeight
        finish()
        if (
          !width ||
          !height ||
          width > 20000 ||
          height > 20000 ||
          width * height > 40_000_000
        )
          reject(new Error("Choose an image smaller than 40 megapixels."))
        else resolve({ width, height })
      }
      image.onerror = () => {
        finish()
        reject(new Error("This file is not a readable image."))
      }
      image.src = url
    }
  )
  const form = new FormData()
  form.set("file", file)
  const response = await fetch(imageFileEndpoint(workspaceId), {
    method: "POST",
    body: form,
  })
  const payload = z
    .object({ file: z.object({ id: z.uuid() }) })
    .parse(await readImageResponse(response))
  return { kind: "image", fileId: payload.file.id, ...dimensions, alt: "" }
}
export function createImageParticle(
  workspaceId: string,
  title: string,
  image: ParticleImage,
  position: ParticlePosition,
  id: string,
  now: string
): Particle {
  const particle = createParticle("activity", { workspaceId, title, id, now })
  if (particle.type !== "activity")
    throw new Error("Invalid image Particle type.")
  return {
    ...particle,
    size: "large",
    position,
    positionMode: "manual",
    data: { ...particle.data, widget: image },
  }
}
