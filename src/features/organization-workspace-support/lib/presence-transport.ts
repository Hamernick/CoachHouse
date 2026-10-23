import type { WorkspaceSupportPresenceResult, WorkspaceSupportPresenceInput } from "../types"

export async function workspacePresenceOverHttp(input: WorkspaceSupportPresenceInput & { leave?: boolean }, signal?: AbortSignal): Promise<WorkspaceSupportPresenceResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener("abort", abort, { once: true })
  const timer = setTimeout(abort, 5000)
  try {
    const response = await fetch("/api/account/workspace-support-presence", {
      method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-coach-house-organization-id": input.organizationId }, body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error("Presence unavailable")
    return await response.json()
  } catch { return { error: "Live presence is temporarily unavailable." } }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
}
