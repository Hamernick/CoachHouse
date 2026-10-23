import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import Image from "@tiptap/extension-image"
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model"

// Structural equivalent of the existing rich-text editor; no browser node views.
const DocumentImage = Image.extend({
  addAttributes() {
    return Object.fromEntries(Object.entries({ src: null, alt: null, title: null,
      width: "100%", height: null, align: "center", caption: "", aspectRatio: null,
      uploading: null, uploadId: null }).map(([name, value]) => [name, { default: value }]))
  },
})
export const documentSchema = getSchema([
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
  Table, TableCell, TableHeader, TableRow, Subscript, Superscript,
  TextAlign.configure({ types: ["heading", "paragraph"] }), DocumentImage,
])
const escape = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

function renderSpec(spec: DOMOutputSpec | number, content: string): string {
  if (spec === 0) return content
  if (typeof spec === "string") return escape(spec)
  if (!Array.isArray(spec) || typeof spec[0] !== "string") throw new Error("Unsupported document node")
  const [tag, ...children] = spec
  if (!/^[a-z][a-z0-9-]*$/i.test(tag)) throw new Error("Invalid document tag")
  let attributes = ""
  if (children[0] && typeof children[0] === "object" && !Array.isArray(children[0])) {
    const attrs = children.shift() as Record<string, unknown>
    attributes = Object.entries(attrs).filter(([, value]) => value != null)
      .map(([name, value]) => ` ${name}="${escape(String(value))}"`).join("")
  }
  if (["br", "hr", "img"].includes(tag)) return `<${tag}${attributes}>`
  return `<${tag}${attributes}>${children.map((child) => renderSpec(child, content)).join("")}</${tag}>`
}
export function serializeDocument(node: ProseMirrorNode): string {
  let inner = ""
  node.forEach((child) => { inner += serializeDocument(child) })
  let html = node.isText ? escape(node.text ?? "") : node.type.name === "doc" ? inner
    : renderSpec(node.type.spec.toDOM!(node), inner)
  for (const mark of [...node.marks].reverse()) html = renderSpec(mark.type.spec.toDOM!(mark, true), html)
  return html
}

export function validateDocument(node: ProseMirrorNode) {
  node.check()
  if (node.content.size > 250_000) throw new Error("Document is too large.")
  const safeUrl = (value: unknown, image = false) => {
    if (typeof value !== "string") return false
    if (value.startsWith("/") && !value.startsWith("//")) return true
    try { return (image ? ["https:", "http:"] : ["https:", "http:", "mailto:", "tel:"]).includes(new URL(value).protocol) }
    catch { return false }
  }
  node.descendants(child => {
    if (child.type.name === "image" && !safeUrl(child.attrs.src, true)) throw new Error("Choose a supported image URL before saving.")
    if (child.marks.some(mark => mark.type.name === "link" && !safeUrl(mark.attrs.href))) throw new Error("This document contains an unsupported link.")
  })
}
