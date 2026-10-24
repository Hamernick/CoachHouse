"use client"

import { useId, useMemo, useState } from "react"
import type { Editor } from "@tiptap/core"
import LinkIcon from "lucide-react/dist/esm/icons/link"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { noteEditorHtml, type NoteContent } from "@/lib/modules/note-content"
import { PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"

function NoteLinkControl({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const id = useId()
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); setError(""); if (next) setUrl(editor?.getAttributes("link").href ?? "") }}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className={PARTICLE_EDITOR_HEADER_ACTION} disabled={!editor} aria-label="Edit link"><LinkIcon aria-hidden /></Button></PopoverTrigger>
    <PopoverContent align="start" className="rounded-2xl shadow-none">
      <form className="flex flex-col gap-3" onSubmit={(event) => {
        event.preventDefault()
        const href = url.trim()
        if (href && !/^(https?:\/\/|mailto:|tel:)/i.test(href)) { setError("Use an https, http, email or telephone link."); return }
        if (href) editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
        else editor?.chain().focus().extendMarkRange("link").unsetLink().run()
        setOpen(false)
      }}>
        <Field><FieldLabel htmlFor={id}>Link</FieldLabel><Input id={id} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="rounded-xl" /></Field>
        {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" type="button" className="rounded-full" onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setOpen(false) }}>Remove</Button><Button className="rounded-full" type="submit">Apply</Button></div>
      </form>
    </PopoverContent>
  </Popover>
}
export function NotesRichEditor({ initialBody, onChange, toolbarId, readOnly }: {
  initialBody: NoteContent; onChange: (body: NoteContent) => void; toolbarId: string; readOnly: boolean
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
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
