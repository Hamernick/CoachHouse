import { getVersion } from "@tiptap/pm/collab"
import type { EditorState } from "@tiptap/pm/state"
import type { DocumentSession } from "../types"

/** An empty outgoing queue alone is not proof that the visible document was saved. */
export function documentAcknowledgesState(state: EditorState, session: DocumentSession, content: string): boolean {
  try {
    return getVersion(state) === session.version
      && state.doc.eq(state.schema.nodeFromJSON(session.document))
      && session.section_content === content
  } catch {
    return false
  }
}
