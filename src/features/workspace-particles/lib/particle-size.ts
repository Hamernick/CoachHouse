import type { Particle } from "../types"

export const PARTICLE_SIZE_NAMES = [
  "small",
  "medium",
  "large",
  "extra_large",
] as const
export type ParticleSize = (typeof PARTICLE_SIZE_NAMES)[number]
export const PARTICLE_GRID = { cell: 192, gap: 16 } as const
export function particleSizeTokens(
  grid: { cell: number; gap: number } = PARTICLE_GRID
) {
  const two = grid.cell * 2 + grid.gap
  return {
    small: { width: grid.cell, height: grid.cell, label: "Small" },
    medium: { width: two, height: grid.cell, label: "Medium" },
    large: { width: two, height: two, label: "Large" },
    extra_large: {
      width: grid.cell * 4 + grid.gap * 3,
      height: two,
      label: "Extra large",
    },
  }
}
export const PARTICLE_SIZES = particleSizeTokens()
// Kept independent of registry/schema to avoid circular runtime imports.
export const PARTICLE_SIZE_SUPPORT = {
  objective: {
    supportedSizes: ["small", "medium", "large"],
    defaultSize: "medium",
  },
  activity: {
    supportedSizes: ["small", "medium", "large", "extra_large"],
    defaultSize: "medium",
  },
  calendar: {
    supportedSizes: ["medium", "large", "extra_large"],
    defaultSize: "large",
  },
  people: {
    supportedSizes: ["small", "medium", "large"],
    defaultSize: "medium",
  },
  decision: { supportedSizes: ["medium", "large"], defaultSize: "medium" },
  metric: {
    supportedSizes: ["small", "medium", "large"],
    defaultSize: "small",
  },
  workflow: {
    supportedSizes: ["medium", "large", "extra_large"],
    defaultSize: "large",
  },
  finance: {
    supportedSizes: ["small", "medium", "large"],
    defaultSize: "medium",
  },
} satisfies Record<
  string,
  { supportedSizes: readonly ParticleSize[]; defaultSize: ParticleSize }
>
export function supportedParticleSizes(
  particle: Pick<Particle, "type">
): readonly ParticleSize[] {
  return PARTICLE_SIZE_SUPPORT[particle.type].supportedSizes
}
// Photos use width presets; their content ratio determines height, including
// the fixed title strip and the frame's two 1px borders. No dimensions persist.
export const PARTICLE_IMAGE_CAPTION_HEIGHT = 36
const IMAGE_WIDTHS = { small: 192, medium: 280, large: 400, extra_large: 816 }
export function isImageParticle(particle: Particle) {
  return (
    particle.type === "activity" &&
    (particle.data.widget?.kind === "image" ||
      particle.data.widget?.kind === "image_placeholder")
  )
}
export function particleResizeDimensions(
  particle: Particle,
  dimensions: { width: number; height: number }
) {
  const image = particle.type === "activity" ? particle.data.widget : undefined
  if (image?.kind !== "image" && image?.kind !== "image_placeholder")
    return dimensions
  const ratio = image.kind === "image" ? image.height / image.width : 9 / 16
  return {
    width: dimensions.width,
    height: (dimensions.width - 2) * ratio + PARTICLE_IMAGE_CAPTION_HEIGHT + 2,
  }
}
export function particleFamilyDimensions(
  particle: Particle,
  size: ParticleSize
) {
  const preset = PARTICLE_SIZES[size]
  return particleResizeDimensions(particle, {
    width: isImageParticle(particle) ? IMAGE_WIDTHS[size] : preset.width,
    height: preset.height,
  })
}
export function nearestParticleSize(
  dimensions: { width: number; height: number },
  supported: readonly ParticleSize[],
  particle?: Particle
): ParticleSize {
  if (!supported.length)
    throw new Error("A Particle must support at least one size.")
  return supported.reduce((best, size) => {
    const distance = (family: ParticleSize) => {
      const target = particle
        ? particleFamilyDimensions(particle, family)
        : PARTICLE_SIZES[family]
      return Math.hypot(
        (dimensions.width - target.width) / target.width,
        (dimensions.height - target.height) / target.height
      )
    }
    return distance(size) < distance(best) ? size : best
  })
}
export function resolveParticleResize(
  start: { width: number; height: number },
  end: { width: number; height: number },
  supported: readonly ParticleSize[],
  particle?: Particle
): ParticleSize | null {
  if (Math.hypot(end.width - start.width, end.height - start.height) < 24)
    return null
  return nearestParticleSize(
    particle ? particleResizeDimensions(particle, end) : end,
    supported,
    particle
  )
}
export function particleSizeStyle(particle: Particle, legacyWidth: number) {
  if (particle.size) return particleFamilyDimensions(particle, particle.size)
  const width = particle.width ?? legacyWidth
  return isImageParticle(particle)
    ? particleResizeDimensions(particle, { width, height: 0 })
    : { width }
}

export const PARTICLE_SIZE_LAYOUTS = {
  small: { variant: "essential", previewLimit: 0 },
  medium: { variant: "summary", previewLimit: 2 },
  large: { variant: "details", previewLimit: 6 },
  extra_large: { variant: "overview", previewLimit: 12 },
} as const
