// Display normalization only; an EIN-shaped value is not verification of tax status.
export function normalizeEin(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!/^\d{2}-?\d{7}$/.test(trimmed)) return null
  return trimmed.replace("-", "")
}

export function formatEin(value: unknown): string | null {
  const ein = normalizeEin(value)
  return ein ? `${ein.slice(0, 2)}-${ein.slice(2)}` : null
}
