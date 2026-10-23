/** ProseMirror JSON retains null-prototype attrs, which React treats as client references. */
export function toPlainDocumentJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
