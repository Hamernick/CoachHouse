import cleanHtml from "sanitize-html"
import { z } from "zod"
import type { NoteContent } from "./note-content"

export const noteContentInput = z.object({ content: z.string().max(20_000), html: z.string().max(120_000).optional() })

/** Accept only the basic editor vocabulary; derive previews from sanitized HTML. */
export function sanitizeNoteContent(input: NoteContent): NoteContent {
  const value = noteContentInput.parse(input)
  if (value.html === undefined) return { content: value.content }
  let content = ""
  const html = cleanHtml(value.html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "a", "code", "pre"],
    allowedAttributes: { a: ["href"], ol: ["start"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
  })
  cleanHtml(html, {
    allowedTags: [], allowedAttributes: {},
    textFilter: (text) => { content += text; return text },
    onCloseTag: (tag) => { if (["p", "br", "h1", "h2", "h3", "li", "blockquote", "pre"].includes(tag)) content += "\n" },
  })
  // textFilter receives escaped text. Decode only entities emitted by the sanitizer.
  content = content.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trimEnd()
  return noteContentInput.parse({ content, html })
}
