// Retrying the same selected files and payload must reuse its server idempotency key.
// Weak keys release request state when the picker no longer retains the files.
const fileIds = new WeakMap<File, string>()
const requestIds = new WeakMap<File, Map<string, string>>()

export function getProjectAssetUploadId(input: {
  projectId: string
  files: File[]
  title?: string
  description?: string
  link?: string
}) {
  const first = input.files[0]
  if (!first) return crypto.randomUUID()
  const files = input.files.map((file) => {
    let id = fileIds.get(file)
    if (!id) { id = crypto.randomUUID(); fileIds.set(file, id) }
    return id
  })
  const key = JSON.stringify([input.projectId, input.title ?? "", input.description ?? "", input.link ?? "", files])
  const requests = requestIds.get(first) ?? new Map<string, string>()
  let id = requests.get(key)
  if (!id) { id = crypto.randomUUID(); requests.set(key, id); requestIds.set(first, requests) }
  return id
}
