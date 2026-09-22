import type { ParticlePlacement } from "../types"

export function hasParticlePositionChanges(
  items: ParticlePlacement[],
  positions: ReadonlyMap<string, { x: number; y: number }>
) {
  const normalize = (value: number) =>
    Math.round(Math.max(-50000, Math.min(50000, value)))
  return items.some((item) => {
    const position = positions.get(item.id)
    return (
      position &&
      (item.x !== normalize(position.x) || item.y !== normalize(position.y))
    )
  })
}
