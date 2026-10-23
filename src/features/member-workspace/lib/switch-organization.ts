import type { MemberWorkspaceSetActiveOrganizationResult } from "../types"

export async function switchOrganization(orgId: string): Promise<MemberWorkspaceSetActiveOrganizationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch("/api/account/active-organization", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }), signal: controller.signal,
    })
    if (!response.ok) throw new Error("Switch failed")
    return await response.json() as MemberWorkspaceSetActiveOrganizationResult
  } catch {
    return { error: "Unable to switch organizations. Please try again." }
  } finally {
    clearTimeout(timeout)
  }
}
