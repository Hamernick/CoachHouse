import "server-only"

import * as Y from "yjs"
import type { JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { createMarkdownAdapter, markdownDocumentSchema } from "../lib/markdown-adapter"
import { DOCUMENT_EDIT_BYTES } from "../lib/contracts"
import { decodeRoomBinary, encodeRoomUpdate, ROOM_CHECKPOINT_BYTES, type DocumentRoom } from "../lib/room-contracts"
import { readDocumentRoomTail, DocumentRoomError } from "../lib/room-client"

/** Validate the actual ProseMirror schema, node count and URLs before exporting.
 * Refuse unsafe/lossy content rather than silently changing a shared document. */
function validateDocument(document: JSONContent) {
  const queue=[document]
  let count=0
  while(queue.length) {
    const node=queue.pop()!
    if(++count>5000) throw new DocumentRoomError("capacity","This document exceeds the shared editor budget.")
    for(const value of [node.type==="image" ? node.attrs?.src : undefined,...(node.marks ?? []).filter(mark=>mark.type==="link").map(mark=>mark.attrs?.href)]) {
      if(value===undefined) continue
      if(typeof value!=="string" || /[\u0000-\u0020\u007f]/.test(value) || value.startsWith("//") || !/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/.test(value) || (node.type==="image" && !/^https?:\/\//.test(value)))
        throw new DocumentRoomError("invalid","A link or image uses an unsupported address. Correct it before saving.")
    }
    if(node.content) queue.push(...node.content)
  }
  const schema=markdownDocumentSchema()
  schema.nodeFromJSON(document).check()
}
export function prepareRestoredMarkdown(content: string) {
  const document=createMarkdownAdapter().parse(content)
  validateDocument(document)
  const seed=prosemirrorJSONToYDoc(markdownDocumentSchema(),document,"content")
  try {return encodeRoomUpdate(Y.encodeStateAsUpdate(seed),ROOM_CHECKPOINT_BYTES)}
  finally {seed.destroy()}
}
export async function serializeDocumentPrefix(client: SupabaseClient<Database>, room: DocumentRoom, sequence: number, preserveBOM: boolean) {
  if(sequence<room.checkpoint_sequence || sequence>room.last_sequence)
    throw new DocumentRoomError("conflict","The shared prefix changed. Refresh its state before saving.")
  const prefix={...room,last_sequence:sequence}
  const document=new Y.Doc()
  try {
    Y.applyUpdate(document,decodeRoomBinary(room.checkpoint))
    let cursor=room.checkpoint_sequence
    while(cursor<sequence) {
      const page=await readDocumentRoomTail(client,prefix,cursor)
      for(const update of page) Y.applyUpdate(document,decodeRoomBinary(update.payload))
      cursor=page[page.length-1].sequence
    }
    const json=yDocToProsemirrorJSON(document,"content")
    validateDocument(json)
    const content=(preserveBOM ? "\uFEFF" : "")+createMarkdownAdapter().serialize(json)
    if(new TextEncoder().encode(content).byteLength>DOCUMENT_EDIT_BYTES)
      throw new DocumentRoomError("capacity","The edited file exceeds the current editing limit.")
    return content
  } finally {document.destroy()}
}
