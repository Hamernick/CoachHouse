import { posToDOMRect, type Editor } from "@tiptap/core"
import { DOMSerializer, DOMParser, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import type { AiTextSelection } from "../types"

export type CapturedTextSelection = AiTextSelection & { document: ProseMirrorNode; id: string; text: string; anchor: DOMRect }

export function captureTextSelection(editor: Editor): CapturedTextSelection | null {
  if (editor.isDestroyed || !editor.isEditable) return null
  const native = window.getSelection()
  if (!native?.rangeCount || !editor.view.dom.contains(native.getRangeAt(0).commonAncestorContainer)) return null
  const { selection, doc } = editor.state
  if (!(selection instanceof TextSelection) || selection.empty) return null
  const text = doc.textBetween(selection.from, selection.to, "\n")
  if (!text.trim()) return null
  const container = document.createElement("div")
  container.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(selection.content().content))
  return { id: crypto.randomUUID(), anchor: posToDOMRect(editor.view, selection.from, selection.to), document: doc, from: selection.from, to: selection.to, html: container.innerHTML, text }
}

export function selectionIsCurrent(editor: Editor, selection: CapturedTextSelection) {
  return !editor.isDestroyed && editor.isEditable && editor.state.doc.eq(selection.document)
}

// One native transaction: existing onUpdate/save/Yjs/undo owners receive exactly
// the same operation as a manual replacement. No whole-document setContent.
export function replaceTextSelection(editor: Editor, selection: CapturedTextSelection, html: string) {
  if (!selectionIsCurrent(editor, selection) || !html.trim()) return false
  const container = document.createElement("div")
  container.innerHTML = html
  const slice = DOMParser.fromSchema(editor.schema).parseSlice(container, { context: editor.state.doc.resolve(selection.from) })
  if (!slice.content.size) return false
  return editor.commands.command(({ tr, dispatch }) => {
    if (!tr.doc.eq(selection.document) || !editor.isEditable) return false
    if (dispatch) tr.replaceRange(selection.from, selection.to, slice).scrollIntoView()
    return true
  })
}
