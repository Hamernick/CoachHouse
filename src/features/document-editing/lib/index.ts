import type { DocumentEditingInput } from "../types"
import { documentSourceSchema } from "./contracts"

export function normalizeDocumentEditingInput(input: DocumentEditingInput) {
  return { source: documentSourceSchema.parse(input.source) }
}
export { documentSourceSchema, documentSnapshotSchema, decodeCompleteDocument, DOCUMENT_EDIT_BYTES } from "./contracts"
