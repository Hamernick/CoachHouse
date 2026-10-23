import { cookies, headers } from "next/headers"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { ORGANIZATION_SCOPE_HEADER, SUPPORT_ORGANIZATION_COOKIE } from "@/lib/organization/support-access"

export async function readOrganizationRequestScope() {
  if (!organizationWorkspaceSupportEnabled) return null
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()])
  const explicit = headerStore.get(ORGANIZATION_SCOPE_HEADER)?.trim() || null
  const support = cookieStore.get(SUPPORT_ORGANIZATION_COOKIE)?.value || null
  // A native/unscoped mutation must not borrow a support target from another tab.
  const method = headerStore.get("x-coach-house-request-method")
  if (support && method && !["GET", "HEAD", "OPTIONS"].includes(method) && !explicit) {
    throw new Error("Reload this workspace before saving. Its organization context is missing.")
  }
  const supportMode = headerStore.get("x-coach-house-support-mode")
  const supportRequested = supportMode === "1" || (supportMode !== "0" && Boolean(support) && (!explicit || explicit === support))
  return { explicit, support, supportRequested, method }
}
