// Missing or invalid dates always sort last; equal dates retain source order.
export function comparePresentationDates(left?: string | Date | null, right?: string | Date | null, newestFirst = false) {
  const a = left instanceof Date ? left.getTime() : left ? Date.parse(left) : NaN
  const b = right instanceof Date ? right.getTime() : right ? Date.parse(right) : NaN
  if (!Number.isFinite(a)) return Number.isFinite(b) ? 1 : 0
  if (!Number.isFinite(b)) return -1
  return newestFirst ? b - a : a - b
}
