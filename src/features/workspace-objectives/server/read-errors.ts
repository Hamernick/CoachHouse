/** Compatibility is only for a genuinely absent requested table. A permission,
 * timeout, or unrelated dependency error must never enable the legacy reader. */
export function isMissingTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  if (record.code !== "42P01" && record.code !== "PGRST205") return false
  const identifiers = [record.message, record.details]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .split(/[^a-zA-Z0-9_]+/)
  return identifiers.includes(tableName)
}
