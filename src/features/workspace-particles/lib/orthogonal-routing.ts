import type { ParticlePosition } from "../types"
import type { ParticleBounds } from "./selection"

export function segmentCrossesParticle(
  a: ParticlePosition,
  b: ParticlePosition,
  box: ParticleBounds
) {
  if (a.x === b.x)
    return (
      a.x > box.x &&
      a.x < box.x + box.width &&
      Math.max(a.y, b.y) > box.y &&
      Math.min(a.y, b.y) < box.y + box.height
    )
  if (a.y === b.y)
    return (
      a.y > box.y &&
      a.y < box.y + box.height &&
      Math.max(a.x, b.x) > box.x &&
      Math.min(a.x, b.x) < box.x + box.width
    )
  return true
}

// Non-hierarchy relationships must not influence ELK's layer assignment. Route
// them on an orthogonal visibility grid around measured card obstacles instead.
export function routeParticleRelationship(
  start: ParticlePosition,
  end: ParticlePosition,
  boxes: ParticleBounds[]
): ParticlePosition[] | null {
  const gap = 24
  const first = { x: start.x + gap, y: start.y }
  const last = { x: end.x - gap, y: end.y }
  const clear = (a: ParticlePosition, b: ParticlePosition) =>
    !boxes.some((box) => segmentCrossesParticle(a, b, box))
  if (!clear(start, first) || !clear(last, end)) return null
  const xs = [
    ...new Set([
      first.x,
      last.x,
      ...boxes.flatMap((box) => [box.x - gap, box.x + box.width + gap]),
    ]),
  ].sort((a, b) => a - b)
  const ys = [
    ...new Set([
      first.y,
      last.y,
      ...boxes.flatMap((box) => [box.y - gap, box.y + box.height + gap]),
    ]),
  ].sort((a, b) => a - b)
  const columns = xs.length
  const origin = ys.indexOf(first.y) * columns + xs.indexOf(first.x)
  const target = ys.indexOf(last.y) * columns + xs.indexOf(last.x)
  const point = (index: number) => ({
    x: xs[index % columns],
    y: ys[Math.floor(index / columns)],
  })
  const queue = [origin]
  const previous = new Map<number, number | null>([[origin, null]])
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]
    if (index === target) break
    const x = index % columns,
      y = Math.floor(index / columns)
    const candidates = [
      x + 1 < columns ? index + 1 : -1,
      x > 0 ? index - 1 : -1,
      y > 0 ? index - columns : -1,
      y + 1 < ys.length ? index + columns : -1,
    ]
    for (const candidate of candidates) {
      if (
        candidate < 0 ||
        previous.has(candidate) ||
        !clear(point(index), point(candidate))
      )
        continue
      previous.set(candidate, index)
      queue.push(candidate)
    }
  }
  if (!previous.has(target)) return null
  const path: ParticlePosition[] = []
  let cursor: number | null = target
  while (cursor !== null) {
    path.unshift(point(cursor))
    cursor = previous.get(cursor) ?? null
  }
  const full = [start, ...path, end]
  return full.filter((item, index) => {
    const before = full[index - 1],
      after = full[index + 1]
    return (
      !before ||
      !after ||
      !(
        (before.x === item.x && item.x === after.x) ||
        (before.y === item.y && item.y === after.y)
      )
    )
  })
}

export function roundedParticleRoute(
  points: readonly ParticlePosition[],
  radius = 12
) {
  if (!points.length) return ""
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1]
    const before = Math.hypot(b.x - a.x, b.y - a.y)
    const after = Math.hypot(c.x - b.x, c.y - b.y)
    const r = Math.max(0, Math.min(radius, before / 2, after / 2))
    if (!r) {
      path += ` L ${b.x} ${b.y}`
      continue
    }
    path += ` L ${b.x + ((a.x - b.x) * r) / before} ${b.y + ((a.y - b.y) * r) / before}`
    path += ` Q ${b.x} ${b.y} ${b.x + ((c.x - b.x) * r) / after} ${b.y + ((c.y - b.y) * r) / after}`
  }
  if (points.length > 1)
    path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`
  return path
}
