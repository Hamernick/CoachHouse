/** Only learner-owned, acknowledged step metadata belongs in the progress bar. */
export function readCompletedModuleStepIds(moduleId: string, value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const record = value as Record<string, unknown>
  if (record.version !== 1 || !record.completed || typeof record.completed !== "object" || Array.isArray(record.completed)) return []
  return Object.keys(record.completed).filter((key) =>
    /^(lesson|video|resources|assignment(:[a-zA-Z0-9_-]+)?)$/.test(key) && key.length <= 200
  ).map((key) => `${moduleId}:${key}`)
}
