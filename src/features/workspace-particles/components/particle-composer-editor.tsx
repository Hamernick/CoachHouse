"use client"

import { Extension, Node } from "@tiptap/core"
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react"
import HardBreak from "@tiptap/extension-hard-break"
import { history, redo, undo, closeHistory } from "@tiptap/pm/history"
import { Plugin } from "@tiptap/pm/state"
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useImperativeHandle, useRef, type HTMLAttributes, type Ref } from "react"
import X from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import type { ComposerContextControl, ComposerContextSelection } from "@/lib/workspace/composer-context"
import { composerCopy, composerDocument, composerOffset, composerPosition, composerReferences, composerText, type ComposerInputHandle } from "../lib/composer-editor"

const ContextChecking = createContext(false)
function Mention({ node, deleteNode, editor }: NodeViewProps) {
  const checking = useContext(ContextChecking)
  const selection = node.attrs.selection as ComposerContextSelection
  if (checking) return <NodeViewWrapper as="span" contentEditable={false} aria-hidden />
  return <NodeViewWrapper as="span" contentEditable={false} className="inline-flex max-w-full align-baseline" data-composer-mention={selection.id}>
    <Button type="button" variant="secondary" disabled={!editor.isEditable}
      aria-label={`Remove ${selection.title} from context`}
      onMouseDown={event => event.preventDefault()} onClick={() => { deleteNode(); editor.commands.focus() }}
      className="mx-0.5 inline-flex h-6 max-w-full gap-1 rounded-md border px-1.5 py-0 align-baseline text-[inherit] font-normal leading-5 shadow-none [&_svg]:size-3">
      <span className="truncate">{selection.title}</span><X aria-hidden />
    </Button>
  </NodeViewWrapper>
}

const extensions = [
  Node.create({ name: "doc", topNode: true, content: "paragraph" }),
  Node.create({ name: "paragraph", content: "inline*", group: "block", parseHTML: () => [{ tag: "p" }], renderHTML: () => ["p", 0] }),
  Node.create({ name: "text", group: "inline" }),
  HardBreak,
  Node.create({ name: "mention", group: "inline", inline: true, atom: true, selectable: false,
    addAttributes: () => ({ selection: { default: null, rendered: false } }),
    renderHTML: ({ node }) => ["span", {}, (node.attrs.selection as ComposerContextSelection).title],
    addNodeView: () => ReactNodeViewRenderer(Mention),
  }),
  Extension.create({ name: "composerHistory", addProseMirrorPlugins: () => [history()],
    addKeyboardShortcuts() { return {
      "Mod-z": () => undo(this.editor.state, this.editor.view.dispatch),
      "Mod-Shift-z": () => redo(this.editor.state, this.editor.view.dispatch),
      "Mod-y": () => redo(this.editor.state, this.editor.view.dispatch),
    } },
  }),
]

type Props = {
  inputRef: Ref<ComposerInputHandle>; value: string; context: ComposerContextControl; disabled: boolean
  placeholder: string; attributes: Record<string, string | boolean | undefined>
  onChange: (value: string) => void
  onCaret: (value: string, caret: number, composing?: boolean, pasted?: boolean) => void
  onKeyDown: HTMLAttributes<HTMLDivElement>["onKeyDown"]
  onBlur: HTMLAttributes<HTMLDivElement>["onBlur"]
  onCompositionStart: () => void
}

export function ParticleComposerEditor(props: Props) {
  const latest = useRef(props)
  latest.current = props
  const pasted = useRef(false)
  const focusPending = useRef(false)
  const guardedExtensions = useMemo(() => [...extensions, Extension.create({
    name: "composerAccess",
    addProseMirrorPlugins: () => [new Plugin({
      appendTransaction: (_transactions, _old, state) => {
        const access = latest.current.context.access
        if (!access) return null
        const tr = state.tr
        state.doc.descendants((node, pos) => {
          const from = tr.mapping.map(pos), to = tr.mapping.map(pos + node.nodeSize)
          if (node.type.name === "mention" && !access.allows(node.attrs.selection)) tr.delete(from, to)
          else if (node.isText) {
            const clean = access.sanitize(node.text!)
            if (clean !== node.text) tr.insertText(clean, from, to)
          }
        })
        return tr.docChanged ? tr.setMeta("addToHistory", false) : null
      },
    })],
  })], [])
  const editor = useEditor({
    immediatelyRender: false, shouldRerenderOnTransaction: false, extensions: guardedExtensions, content: composerDocument(props.value, props.context.selected),
    editable: !props.disabled,
    editorProps: {
      attributes: { role: "textbox", "aria-multiline": "true", class: "min-h-6 outline-none whitespace-pre-wrap break-words [&_p]:m-0" },
      transformCopied: slice => composerCopy(slice, latest.current.context.access),
      handlePaste(_view, event) {
        event.preventDefault(); pasted.current = true
        const value = event.clipboardData?.getData("text/plain") ?? ""
        const content = composerDocument(value, []).content![0].content ?? []
        editor?.commands.insertContent(content)
        return true
      },
      clipboardTextSerializer: slice => {
        let text = ""
        slice.content.descendants(node => {
          if (node.isText) text += node.text
          else if (node.type.name === "mention") text += `@${(node.attrs.selection as ComposerContextSelection).title}`
          else if (node.type.name === "hardBreak") text += "\n"
        })
        return text
      },
    },
    onUpdate: ({ editor }) => {
      const { state, view } = editor, value = composerText(state.doc)
      latest.current.context.reconcile(composerReferences(state.doc))
      latest.current.onChange(value)
      latest.current.onCaret(value, composerOffset(state.doc, state.selection.from), view.composing, pasted.current)
      pasted.current = false
    },
    onSelectionUpdate: ({ editor }) => {
      if (!editor.view.hasFocus()) return
      latest.current.onCaret(composerText(editor.state.doc), composerOffset(editor.state.doc, editor.state.selection.from), editor.view.composing, pasted.current)
    },
  })
  useImperativeHandle(props.inputRef, () => ({
    focus: () => {
      if (editor) editor.commands.focus(undefined, { scrollIntoView: false })
      else focusPending.current = true
    },
    get selectionStart() { return editor ? composerOffset(editor.state.doc, editor.state.selection.from) : null },
    setSelectionRange: (start, end) => {
      if (editor) editor.commands.setTextSelection({ from: composerPosition(editor.state.doc, start), to: composerPosition(editor.state.doc, end) })
    },
    insertMention: (selection, start, end) => {
      const access = latest.current.context.access
      if (!editor || access?.checking || (access && !access.allows(selection))) return
      editor.view.dispatch(closeHistory(editor.state.tr))
      editor.chain().focus().insertContentAt({ from: composerPosition(editor.state.doc, start), to: composerPosition(editor.state.doc, end) },
        [{ type: "mention", attrs: { selection } }, { type: "text", text: " " }]).run()
      editor.view.dispatch(closeHistory(editor.state.tr))
    },
    removeRange: (start, end) => {
      if (editor) editor.commands.deleteRange({ from: composerPosition(editor.state.doc, start), to: composerPosition(editor.state.doc, end) })
    },
  }), [editor])
  useLayoutEffect(() => {
    // Run the same guard before paint and on every transaction, including Undo/Redo.
    if (editor) editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false))
  }, [editor, props.context.access?.version])
  useEffect(() => {
    if (editor && focusPending.current) { focusPending.current = false; editor.commands.focus("end", { scrollIntoView: false }) }
  }, [editor])
  useEffect(() => {
    if (editor && composerText(editor.state.doc) !== props.value) editor.commands.setContent(composerDocument(props.value, latest.current.context.selected), { emitUpdate: false })
  }, [editor, props.value])
  useEffect(() => { editor?.setEditable(!props.disabled) }, [editor, props.disabled])
  useEffect(() => {
    if (!editor) return
    for (const [name, value] of Object.entries(props.attributes)) {
      if (value === undefined) editor.view.dom.removeAttribute(name)
      else editor.view.dom.setAttribute(name, String(value))
    }
  }, [editor, props.attributes])
  return <div className="relative min-h-9 min-w-0 flex-1 px-1.5 py-1.5 text-base leading-6 md:text-sm [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:py-2.5">
    {!props.value && <span aria-hidden className="pointer-events-none absolute text-muted-foreground">{props.placeholder}</span>}
    <ContextChecking.Provider value={Boolean(props.context.access?.checking)}><EditorContent editor={editor} className="max-h-32 overflow-y-auto" inert={props.disabled || undefined} onKeyDownCapture={event => {
      if (!(event.target as HTMLElement).closest("button")) props.onKeyDown?.(event)
    }} onBlur={props.onBlur} onCompositionStart={props.onCompositionStart} /></ContextChecking.Provider>
  </div>
}
