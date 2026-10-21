/** Notes keep a plain-text projection for existing canvas and Documents readers. */
export type NoteContent = { content: string; html?: string }

export function notePreview(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return { title: lines[0]?.slice(0, 240) || "New note", summary: lines[1]?.slice(0, 500) || "" }
}

export function noteEditorHtml(note: NoteContent) {
  if (note.html !== undefined) return note.html
  const escaped = note.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return escaped.split(/\r?\n/).map((line) => `<p>${line || "<br>"}</p>`).join("")
}

export function sameNoteContent(left: NoteContent, right: NoteContent) {
  return left.content === right.content && left.html === right.html
}
