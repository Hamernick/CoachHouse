import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { getSchema, type Editor } from "@tiptap/core"
import type { UseEditorOptions } from "@tiptap/react"
import { EditorState } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { RichTextEditor } from "@/components/rich-text-editor"
import { buildRichTextExtensions } from "@/components/rich-text-editor/extensions"

const captured = vi.hoisted(() => ({ options: null as UseEditorOptions | null }))
vi.mock("@tiptap/react", () => ({
  useEditor: (options: UseEditorOptions) => { captured.options = options; return null },
  useEditorState: vi.fn(),
  EditorContent: () => null,
  ReactNodeViewRenderer: vi.fn(),
  NodeViewWrapper: () => null,
  NodeViewContent: () => null,
}))
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

function fixture() {
  const html = vi.fn(() => "<p>Changed</p>")
  const json = vi.fn(() => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Changed" }] }] }))
  const editor = {
    getHTML: html, getJSON: json, isDestroyed: false,
    state: { doc: { textContent: "Changed", childCount: 1 } },
    storage: { characterCount: { words: () => 1, characters: () => 7 } },
    view: { dom: { dataset: {} } },
  } as unknown as Editor
  const transaction = EditorState.create({ schema: getSchema([StarterKit]) }).tr
  return { editor, transaction, appendedTransactions: [], html, json }
}

describe("shared editor transaction ownership", () => {
  it("keeps 60 native edits live without whole-file serialization; discovers links after a pause", async () => {
    vi.useFakeTimers()
    const controlled = vi.fn(), nativeUpdate = vi.fn()
    renderToStaticMarkup(createElement(RichTextEditor, {
      value: "", onChange: controlled,
      session: { initialContent: "<p>Initial</p>", active: true, history: "local", onUpdate: nativeUpdate },
    }))
    const event = fixture()
    for (let i = 0; i < 60; i++) captured.options?.onUpdate?.(event)
    expect(nativeUpdate).toHaveBeenCalledTimes(60)
    expect(controlled).not.toHaveBeenCalled()
    expect(event.html).not.toHaveBeenCalled()
    expect(event.json).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(event.json).toHaveBeenCalledOnce()
    expect(event.html).not.toHaveBeenCalled()
    expect(captured.options?.shouldRerenderOnTransaction).toBe(false)
  })
  it("retains existing controlled roadmap updates", () => {
    const controlled = vi.fn()
    renderToStaticMarkup(createElement(RichTextEditor, { value: "<p>Initial</p>", onChange: controlled }))
    const event = fixture()
    captured.options?.onUpdate?.(event)
    expect(controlled).toHaveBeenCalledWith("<p>Changed</p>")
    expect(event.html).toHaveBeenCalledOnce()
    expect(event.json).toHaveBeenCalledOnce()
    expect(captured.options?.shouldRerenderOnTransaction).toBeUndefined()
  })
  it("does not rediscover links or serialize while an editor is inactive", async () => {
    vi.useFakeTimers()
    const nativeUpdate = vi.fn()
    renderToStaticMarkup(createElement(RichTextEditor, {
      value: "", onChange: vi.fn(), session: { initialContent: "", active: false, history: "local", onUpdate: nativeUpdate },
    }))
    const event = fixture()
    captured.options?.onUpdate?.(event)
    await vi.advanceTimersByTimeAsync(60000)
    expect(nativeUpdate).toHaveBeenCalledOnce()
    expect(event.json).not.toHaveBeenCalled()
    expect(event.html).not.toHaveBeenCalled()
  })
  it("refuses collaborative sessions without a binding", () => {
    expect(() => renderToStaticMarkup(createElement(RichTextEditor, {
      value: "", onChange: vi.fn(), session: { active: true, history: "collaborative", onUpdate: vi.fn() },
    }))).toThrow("collaboration extension")
  })
  it("preserves normal history while collaborative history has one owner", () => {
    const ordinary = buildRichTextExtensions({ placeholderRef: { current: "" }, isReadOnly: false, enableImages: false })[0]
    const shared = buildRichTextExtensions({ placeholderRef: { current: "" }, isReadOnly: false, enableImages: false, fileSession: true, collaborativeHistory: true })[0]
    expect(ordinary.options.undoRedo).not.toBe(false)
    expect(ordinary.options.codeBlock).toBe(false)
    expect(shared.options.undoRedo).toBe(false)
    expect(shared.options.codeBlock).not.toBe(false)
  })
})
