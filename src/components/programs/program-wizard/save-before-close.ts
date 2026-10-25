export async function saveProgramBeforeClose({
  save,
  getRevision,
  close,
}: {
  save: () => Promise<string | null>
  getRevision: () => number
  close: () => void
}): Promise<
  { status: "closed" | "changed" } | { status: "failed"; error: string }
> {
  const revision = getRevision()
  try {
    const error = await save()
    if (error) return { status: "failed", error }
  } catch {
    return {
      status: "failed",
      error:
        "Could not save activity. Your edits are still available; try again.",
    }
  }
  // A user may keep typing while a save is in flight. Do not close over changes
  // that were made after the saved snapshot, even when that save succeeded.
  if (revision !== getRevision()) return { status: "changed" }
  close()
  return { status: "closed" }
}
