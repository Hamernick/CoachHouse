/** Browser metadata invalidation only; never an authorization decision. */
export const WORKSPACE_ACCESS_CHANGED = "coach-house:workspace-access-changed"
const CHANNEL = WORKSPACE_ACCESS_CHANGED
let source: string | undefined
const sourceId = () => source ??= crypto.randomUUID()

export function notifyWorkspaceAccessChanged(orgId: string) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_ACCESS_CHANGED, { detail: { orgId } }))
  const message = { version: 1, orgId, source: sourceId() }
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(message)
    channel.close()
    return
  } catch { /* Older or restricted browsers can use the storage event. */ }
  try {
    // No roster, document metadata, or durable access state is stored.
    localStorage.setItem(CHANNEL, JSON.stringify(message))
    localStorage.removeItem(CHANNEL)
  } catch { /* Focus/visibility revalidation still works without either transport. */ }
}

export function subscribeWorkspaceAccessChanged(orgId: string, invalidate: () => void) {
  const local = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.orgId === orgId) invalidate()
  }
  const receive = (value: unknown) => {
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
      || !("orgId" in value) || value.orgId !== orgId || !("source" in value)
      || typeof value.source !== "string" || value.source === sourceId()) return
    invalidate()
  }
  const storage = (event: StorageEvent) => {
    if (event.key !== CHANNEL || !event.newValue) return
    try { receive(JSON.parse(event.newValue)) } catch { /* Ignore unrelated malformed data. */ }
  }
  let channel: BroadcastChannel | undefined
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = event => receive(event.data)
  } catch { /* Local/storage listeners remain available. */ }
  window.addEventListener(WORKSPACE_ACCESS_CHANGED, local)
  window.addEventListener("storage", storage)
  return () => {
    channel?.close()
    window.removeEventListener(WORKSPACE_ACCESS_CHANGED, local)
    window.removeEventListener("storage", storage)
  }
}
