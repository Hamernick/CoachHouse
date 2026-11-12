export type Point = { x: number; y: number }
export type Rect = Point & { width: number; height: number }
export const SIZE = 44
export const GAP = 10
export function overlaps(a: Rect, b: Rect, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width > b.x - gap && a.y < b.y + b.height + gap && a.y + a.height > b.y - gap
}
export function buttonRect(p: Point): Rect { return { x: p.x - SIZE / 2, y: p.y - SIZE / 2, width: SIZE, height: SIZE } }
export function free(p: Point, size: Point, obstacles: Rect[], gap = GAP) {
  const r = buttonRect(p)
  return r.x >= gap && r.y >= gap && r.x + r.width <= size.x - gap && r.y + r.height <= size.y - gap && obstacles.every(o => !overlaps(r, o, gap))
}
export function visibleFraction(rect: Rect, size: Point) {
  return Math.max(0, Math.min(rect.x + rect.width, size.x) - Math.max(0, rect.x)) * Math.max(0, Math.min(rect.y + rect.height, size.y) - Math.max(0, rect.y)) / (rect.width * rect.height)
}
export function home(size: Point) { return { x: size.x / 2 + (size.x > 1000 ? 45 : 0), y: size.y - (size.x < 700 ? 110 : 100) } }
/** Closest free perimeter point to the ray toward chat. Small history weight prevents corner chatter. */
export function edgeTarget(target: Point, size: Point, obstacles: Rect[], previous: Point | null): Point | null {
  const inset = SIZE / 2 + GAP, cx = size.x / 2, cy = size.y / 2
  const dx = target.x - cx, dy = target.y - cy
  const scale = Math.min((cx - inset) / (Math.abs(dx) || .001), (cy - inset) / (Math.abs(dy) || .001))
  const ideal = { x: cx + dx * scale, y: cy + dy * scale }
  const points: Point[] = [ideal]
  for (let x = inset; x <= size.x - inset; x += 6) points.push({ x, y: inset }, { x, y: size.y - inset })
  for (let y = inset; y <= size.y - inset; y += 6) points.push({ x: inset, y }, { x: size.x - inset, y })
  const score = (p: Point) => Math.hypot(p.x - ideal.x, p.y - ideal.y) + (previous ? .08 * Math.hypot(p.x - previous.x, p.y - previous.y) : 0)
  const nearest = (candidates: Point[]) => candidates.filter(p => free(p, size, obstacles)).sort((a, b) => score(a) - score(b))[0] ?? null
  const edge = nearest(points)
  if (edge) return edge
  // If the perimeter is occupied, use the nearest free interior point. Never cover controls.
  const interior: Point[] = []
  for (let x = inset; x <= size.x - inset; x += SIZE + GAP) for (let y = inset; y <= size.y - inset; y += SIZE + GAP) interior.push({ x, y })
  return nearest(interior)
}
export function safeTransition(from: Point | null, to: Point, obstacles: Rect[]) {
  if (!from) return false
  const swept = { x: Math.min(from.x, to.x) - SIZE / 2, y: Math.min(from.y, to.y) - SIZE / 2, width: Math.abs(to.x - from.x) + SIZE, height: Math.abs(to.y - from.y) + SIZE }
  return (Math.abs(from.x - to.x) < 1 || Math.abs(from.y - to.y) < 1) && obstacles.every(o => !overlaps(swept, o, GAP))
}
