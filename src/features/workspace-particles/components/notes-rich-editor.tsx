"use client"

import { ParticleButton as Button, ParticleInput as Input } from "@/components/ui/particle-ui"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import LinkIcon from "lucide-react/dist/esm/icons/link"
import { RichTextEditor } from "@/components/rich-text-editor"


import { Field, FieldLabel } from "@/components/ui/field"
import { ParticlePopover as Popover } from "@/components/ui/particle-ui"
import { noteEditorHtml, type NoteContent } from "@/lib/modules/note-content"
import { PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"

function NoteLinkControl({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const id = useId()
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); setError(""); if (next) setUrl(editor?.getAttributes("link").href ?? "") }}>
    <Popover.Trigger><Button color="secondary" uniform variant="ghost" size="lg" className={PARTICLE_EDITOR_HEADER_ACTION} disabled={!editor} aria-label="Edit link"><LinkIcon aria-hidden /></Button></Popover.Trigger>
    <Popover.Content minWidth={0} align="start" className="rounded-2xl shadow-none">
      <form className="flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault()
        const href = url.trim()
        if (href && !/^(https?:\/\/|mailto:|tel:)/i.test(href)) { setError("Use an https, http, email or telephone link."); return }
        if (href) editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
        else editor?.chain().focus().extendMarkRange("link").unsetLink().run()
        setOpen(false)
      }}>
        <Field><FieldLabel htmlFor={id}>Link</FieldLabel><Input autoFocus size="2xl" id={id} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="rounded-xl" /></Field>
        {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
        <div className="flex justify-end gap-2"><Button color="secondary" size="lg" variant="ghost" type="button" className="rounded-full" onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setOpen(false) }}>Remove</Button><Button color="primary" size="lg" className="rounded-full" type="submit">Apply</Button></div>
      </form>
    </Popover.Content>
  </Popover>
}
export function NotesRichEditor({ initialBody, onChange, toolbarId, readOnly, autoFocus = false }: {
  initialBody: NoteContent; onChange: (body: NoteContent) => void; toolbarId: string; readOnly: boolean; autoFocus?: boolean
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const focused = useRef(false)
  useEffect(() => { if (editor && autoFocus && !readOnly && !focused.current) { focused.current = true; editor.commands.focus() } }, [editor, autoFocus, readOnly])
  const session = useMemo(() => ({ history: "local" as const, initialContent: noteEditorHtml(initialBody), active: true,
    onReady: setEditor,
    onUpdate: (instance: Editor) => onChange({ content: instance.getText({ blockSeparator: "\n" }), html: instance.getHTML() }),
  }), [initialBody, onChange])
  return <RichTextEditor value="" onChange={() => {}} session={session} readOnly={readOnly}
    ariaLabel="Note content" placeholder="Write a note…" mode="compact" disableResize
    basicToolbar hideLinkPreviews toolbarPortalId={toolbarId}
    toolbarTrailingActions={<NoteLinkControl editor={editor} />}
    toolbarClassName="flex-nowrap gap-0 border-0 p-0 [&>span]:hidden [&_button]:rounded-full [@media(pointer:coarse)]:[&_button]:min-h-11 [@media(pointer:coarse)]:[&_button]:min-w-11"
    className="flex min-h-full flex-col rounded-none border-0 bg-transparent shadow-none"
    countClassName="hidden" editorClassName="min-h-[300px] px-5 py-3 md:px-8 dark:bg-transparent"
    contentClassName="flex-1" />
}
