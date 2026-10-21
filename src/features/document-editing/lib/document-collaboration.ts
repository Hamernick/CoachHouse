import Collaboration from "@tiptap/extension-collaboration"
import type { Doc } from "yjs"

/** Bind only after the authorized room checkpoint has synchronized. The shared
 * RichTextEditor session disables StarterKit history and does not reseed text. */
export function documentCollaborationExtensions(document: Doc) {
  return [Collaboration.configure({ document, field: "content" })]
}
