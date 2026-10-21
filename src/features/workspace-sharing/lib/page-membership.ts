export function movePageMember(ids: readonly string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id), target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
