import type { NoteDocument } from "./particle-notes"

export function pageNotes(notes: NoteDocument[], limit: number, cursor?: string | null) {
  const sorted = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
  let remaining = sorted
  if (cursor) {
    const [updatedAt, id] = JSON.parse(cursor) as unknown[]
    if (typeof updatedAt !== "string" || typeof id !== "string") throw new Error("Invalid notes cursor.")
    remaining = sorted.filter((note) => note.updatedAt < updatedAt || (note.updatedAt === updatedAt && note.id > id))
  }
  const page = remaining.slice(0, limit)
  const last = page.at(-1)
  return { notes: page, nextCursor: remaining.length > limit && last ? JSON.stringify([last.updatedAt, last.id]) : null }
}
