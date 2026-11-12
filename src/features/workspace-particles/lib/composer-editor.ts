import type { JSONContent } from "@tiptap/core"
import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { ComposerContextAccess, ComposerContextSelection } from "@/lib/workspace/composer-context"

/** Both HTML and plain-text clipboard/drag serialization must honor the boundary. */
export function composerCopy(slice: Slice, access?: ComposerContextAccess) {
  if (!access) return slice
  const clean = (fragment: Fragment): Fragment => {
    const nodes: ProseMirrorNode[] = []
    fragment.forEach(node => {
      if (node.type.name === "mention" && (access.checking || !access.allows(node.attrs.selection))) return
      if (node.isText) {
        const text = access.sanitize(node.text!)
        if (text) nodes.push(node.type.schema.text(text, node.marks))
      } else nodes.push(node.copy(clean(node.content)))
    })
    return Fragment.from(nodes)
  }
  return new Slice(clean(slice.content), slice.openStart, slice.openEnd)
}

export type ComposerInputHandle = {
  focus: (options?: FocusOptions) => void
  readonly selectionStart: number | null
  setSelectionRange: (start: number, end: number) => void
  insertMention?: (item: ComposerContextSelection, start: number, end: number) => void
  removeRange?: (start: number, end: number) => void
}

export function composerText(node: ProseMirrorNode): string {
  if (node.isText) return node.text ?? ""
  if (node.type.name === "mention") return (node.attrs.selection as ComposerContextSelection).token
  if (node.type.name === "hardBreak") return "\n"
  let text = ""
  node.forEach(child => { text += composerText(child) })
  return text
}

export function composerReferences(doc: ProseMirrorNode) {
  const items = new Map<string, ComposerContextSelection>()
  doc.descendants(node => {
    if (node.type.name === "mention") {
      const selection = node.attrs.selection as ComposerContextSelection
      items.set(selection.id, selection)
    }
  })
  return [...items.values()]
}

// Prompt offsets count the serialized reference; editor positions count each chip once.
export function composerOffset(doc: ProseMirrorNode, position: number) {
  let offset = 0
  doc.firstChild?.forEach((node, index) => {
    const start = index + 1
    if (position >= start + node.nodeSize) offset += composerText(node).length
    else if (position > start && node.isText) offset += position - start
  })
  return offset
}

export function composerPosition(doc: ProseMirrorNode, offset: number) {
  let remaining = offset, position = 1, found = false
  doc.firstChild?.forEach((node, index) => {
    if (found) return
    const length = composerText(node).length
    if (remaining <= length) {
      position = index + 1 + (node.isText ? remaining : remaining ? node.nodeSize : 0)
      found = true
    } else { remaining -= length; position = index + 1 + node.nodeSize }
  })
  return position
}

export function composerDocument(value: string, selections: ComposerContextSelection[]): JSONContent {
  const content: JSONContent[] = []
  let text = ""
  const flush = () => { if (text) content.push({ type: "text", text }); text = "" }
  for (let index = 0; index < value.length;) {
    const selection = selections.find(item => value.startsWith(item.token, index))
    if (selection) {
      flush(); content.push({ type: "mention", attrs: { selection } }); index += selection.token.length
    } else if (value[index] === "\n") { flush(); content.push({ type: "hardBreak" }); index++ }
    else text += value[index++]
  }
  flush()
  return { type: "doc", content: [{ type: "paragraph", content }] }
}
