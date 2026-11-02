import "server-only"

import { createHash } from "node:crypto"
import { WorkspaceSharingError } from "./page-projection"

export const PUBLIC_DOCUMENT_LIMIT = 262_144
export const PUBLIC_DOCUMENT_COUNT_LIMIT = 8
export const PUBLIC_DOCUMENT_PAGE_LIMIT = 1_048_576
export function supportsPublicDocumentMime(mime: string) {
  return ["text/plain", "text/markdown", "text/x-markdown", "text/csv", "application/octet-stream"].includes(mime.toLowerCase())
}

/** A complete UTF-8 text copy, never HTML, Markdown execution, embedded links,
 * spreadsheet evaluation or a partial extraction presented as the whole file. */
export function preparePageDocument(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > PUBLIC_DOCUMENT_LIMIT || !supportsPublicDocumentMime(mime))
    throw new WorkspaceSharingError("unsupported", "Share a text, Markdown or CSV file up to 256 KB.")
  let text: string
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { throw new WorkspaceSharingError("unsupported", "Save this document as UTF-8 text before sharing.") }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))
    throw new WorkspaceSharingError("unsupported", "This document contains unsupported binary content.")
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") }
}
