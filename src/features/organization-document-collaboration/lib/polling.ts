// Preserve responsive co-editing while avoiding full document reads in idle tabs.
export function documentPollingInterval(pending: boolean, collaborating: boolean, retryAt = 0) {
  const retryDelay = retryAt - Date.now()
  if (retryDelay > 0) return retryDelay
  return pending || collaborating ? 2000 : 15_000
}

// Presence expires after 20s. Allow room for the 5s transport deadline.
export function documentPresenceInterval(collaborating: boolean) {
  return collaborating ? 5000 : 10_000
}
