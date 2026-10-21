import {
  getParticleImage,
  isImagePlaceholder,
  type ParticleImage,
} from "./particle-image"
import type { Particle, ParticleOperation } from "../types"

export type ParticleUploadOperation = Extract<
  ParticleOperation,
  { kind: "put_particle" }
>

export function fillImagePlaceholder(
  particle: Particle,
  image: ParticleImage,
  title: string
): ParticleUploadOperation {
  if (
    particle.type !== "activity" ||
    !isImagePlaceholder(particle) ||
    particle.locked ||
    particle.canvasHidden
  )
    throw new Error("This image placeholder is no longer available.")
  return {
    kind: "put_particle",
    expectedRevision: particle.revision,
    particle: {
      ...particle,
      title: particle.title === "Image" ? title : particle.title,
      data: { ...particle.data, widget: image },
    },
  }
}

// A saved upload may be acknowledged after a retry. Never recreate a deleted
// placeholder or overwrite another editor's changes while reconciling it.
export function pendingParticleUploads(
  operations: readonly ParticleUploadOperation[],
  particles: readonly Particle[]
): ParticleUploadOperation[] | null {
  const pending: ParticleUploadOperation[] = []
  for (const operation of operations) {
    const current = particles.find(
      (particle) => particle.id === operation.particle.id
    )
    if (operation.expectedRevision === null) {
      if (!current) pending.push(operation)
      continue
    }
    const image = getParticleImage(operation.particle)
    if (image && current && getParticleImage(current)?.fileId === image.fileId)
      continue
    if (
      !current ||
      current.revision !== operation.expectedRevision ||
      current.locked ||
      current.canvasHidden ||
      !isImagePlaceholder(current)
    )
      return null
    pending.push(operation)
  }
  return pending
}
