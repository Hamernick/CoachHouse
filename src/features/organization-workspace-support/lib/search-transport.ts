import type { WorkspaceSupportSearchResult } from "../types"

// Directory searches must not queue behind navigation or presence server actions.
export async function searchSupportOrganizationsOverHttp(
  query: string,
  offset: number,
  signal?: AbortSignal,
): Promise<WorkspaceSupportSearchResult> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) cancel()
  const timeout = setTimeout(cancel, 10_000)
  try {
    const response = await fetch("/api/account/workspace-support-search", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, offset }), signal: controller.signal,
    })
    if (!response.ok) throw new Error("Search failed")
    const result = await response.json() as WorkspaceSupportSearchResult
    if (!Array.isArray(result.organizations) || typeof result.total !== "number" || typeof result.hasMore !== "boolean") {
      throw new Error("Invalid search response")
    }
    return result
  } catch {
    return { organizations: [], total: 0, hasMore: false, error: controller.signal.aborted
      ? "Search took too long. Try again."
      : "Search unavailable. Try again." }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", cancel)
  }
}
