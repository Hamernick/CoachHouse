import * as Y from "yjs"
import { yDocToProsemirrorJSON } from "@tiptap/y-tiptap"
import { createMarkdownAdapter } from "./markdown-adapter"
import { encodeDocumentRecovery, type DocumentRecoveryState } from "./document-recovery"

/** Export is explicit and never applies an old generation to the current room.
 * Legacy outboxes without a complete snapshot remain honestly labeled data. */
export function documentRecoveryExport(recovery: DocumentRecoveryState) {
  if (!recovery.snapshot) return { name: "document-recovery-data.json", type: "application/json", content: new TextDecoder().decode(encodeDocumentRecovery(recovery)) }
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, recovery.snapshot)
    const content = yDocToProsemirrorJSON(document, "content")
    try { return { name: "recovered-document.md", type: "text/markdown;charset=utf-8", content: createMarkdownAdapter().serialize(content) } }
    catch { return { name: "recovered-document.json", type: "application/json", content: JSON.stringify(content, null, 2) } }
  } finally { document.destroy() }
}
