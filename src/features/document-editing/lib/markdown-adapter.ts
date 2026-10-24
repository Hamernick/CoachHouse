import type { JSONContent } from "@tiptap/core"
import { getSchema } from "@tiptap/core"
import { MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { DOCUMENT_EDIT_BYTES } from "./contracts"

export function markdownDocumentExtensions() {
  return [StarterKit, Image, Table, TableRow, TableHeader, TableCell]
}
export function markdownDocumentSchema() {
  return getSchema(markdownDocumentExtensions())
}

/** Worker-safe Markdown core. HTML requires the sanitized browser adapter;
 * reject it here instead of silently treating HTML as plain text in a worker. */
export function createMarkdownAdapter() {
  const manager = new MarkdownManager({
    extensions: markdownDocumentExtensions(),
    markedOptions: { gfm: true, breaks: false },
  })
  function parse(source: string): JSONContent {
    if (new TextEncoder().encode(source).length > DOCUMENT_EDIT_BYTES)
      throw new Error("This file exceeds the current editing limit.")
    const tokens = manager.instance.lexer(source)
    let unsupported = false
    manager.instance.walkTokens(tokens, (token) => {
      if (token.type === "html" || (token.type === "list_item" && token.task)) unsupported = true
    })
    // Footnotes are not represented by the installed Markdown extension.
    if (unsupported || /^\[\^[^\]]+\]:/m.test(source))
      throw new Error("This Markdown needs the source/HTML adapter before rich editing. The original is unchanged.")
    return manager.parse(source.replace(/^\uFEFF/, ""))
  }
  function serialize(document: JSONContent): string {
    assertPortableMarks(document)
    const expected = JSON.stringify(normalizeDocument(document))
    const output = manager.serialize(structuredClone(document))
    // Prove that serialization did not drop an unsupported node/mark/attribute.
    // Normalization strips editor defaults but retains semantic attributes.
    if (JSON.stringify(normalizeDocument(parse(output))) !== expected)
      throw new Error("These edits cannot be saved faithfully as Markdown. Keep the draft and use the source/HTML adapter.")
    return output
  }
  return { parse, serialize }
}

function assertPortableMarks(node: JSONContent) {
  const portable = new Set(["bold", "italic", "strike", "code", "link"])
  if (node.marks?.some((mark) => !portable.has(mark.type)))
    throw new Error("These edits cannot be saved faithfully as Markdown. The source/HTML adapter is required.")
  node.content?.forEach(assertPortableMarks)
}

function normalizeDocument(node: JSONContent): unknown {
  const attrs = Object.fromEntries(Object.entries(node.attrs ?? {}).filter(([key, value]) => {
    if (value === null || value === undefined) return false
    if (key === "textAlign" && value === "left") return false
    if (key === "start" && value === 1) return false
    if (["target", "rel", "class"].includes(key)) return false
    return true
  }).sort(([a], [b]) => a.localeCompare(b)))
  return {
    type: node.type,
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(node.marks?.length ? { marks: [...node.marks].sort((a, b) => a.type.localeCompare(b.type)).map(normalizeDocument) } : {}),
    ...(node.content?.length ? { content: node.content.map(normalizeDocument) } : {}),
  }
}
