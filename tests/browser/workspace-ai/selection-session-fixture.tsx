import { useMemo, useState } from "react"
import * as Y from "yjs"
import { RichTextEditor } from "../../../src/components/rich-text-editor"
import { documentCollaborationExtensions } from "../../../src/features/document-editing/lib/document-collaboration"

// Real Tiptap/Yjs binding; transport and AI stay inside the disposable fixture.
export function SelectionSessionFixture() {
  const [document] = useState(() => new Y.Doc())
  const extensions = useMemo(() => documentCollaborationExtensions(document), [document])
  const [note, setNote] = useState("")
  return <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
    <RichTextEditor ariaLabel="Session note" value="" onChange={() => undefined} hideLinkPreviews
      session={{ history: "local", active: true, initialContent: "<p>We support neighborhood gardens.</p>", onUpdate: editor => setNote(editor.getHTML()) }} />
    <output aria-label="Saved note draft">{note}</output>
    <RichTextEditor ariaLabel="Shared document" value="" onChange={() => undefined} hideLinkPreviews
      session={{ history: "collaborative", active: true, extensions, onUpdate: () => undefined }} />
    <RichTextEditor ariaLabel="Collaborator document" value="" onChange={() => undefined} hideLinkPreviews
      session={{ history: "collaborative", active: true, extensions, onUpdate: () => undefined }} />
    <RichTextEditor ariaLabel="Read-only document" value="<p>Read only</p>" onChange={() => undefined} readOnly hideLinkPreviews />
  </main>
}
