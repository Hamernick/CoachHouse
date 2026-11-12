import type { DocumentSource } from "@/features/document-editing/types"
export async function openDocumentWindowView({ source }: { source: DocumentSource }) {
  const response = await fetch("/fixture/native-window", { method: "POST", body: JSON.stringify(source) })
  if (!response.ok) throw new Error("Document unavailable")
  return response.json()
}
export async function openWritableDocument() { throw new Error("Writes are outside this read fixture") }
export async function saveUploadedDocument() { throw new Error("Writes are outside this read fixture") }
export async function readUploadedDocumentVersions() { throw new Error("Versions are outside this read fixture") }
