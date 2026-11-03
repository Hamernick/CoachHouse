// Browser interaction fixture only. SQL tests prove real identity and permissions.
import { pageAccessCommandSchema, type PageAccessData } from "../../../src/features/workspace-sharing/lib/page-access"
import type { WorkspacePageSnapshot } from "../../../src/features/workspace-sharing/types"
type Invitation = PageAccessData["invitations"][number]
type Store = { invites: Invitation[]; calls: unknown[]; operations: string[]; lost?: boolean }
const key = "sharing-guests-fixture"
const read = (): Store => JSON.parse(localStorage.getItem(key) ?? '{"invites":[],"calls":[],"operations":[]}')
export async function workspacePageAccessAction(input: unknown) {
  const command = pageAccessCommandSchema.parse(input)
  const params = new URLSearchParams(location.search)
  const person = params.get("person") ?? "1"
  if (person === "anonymous") return { ok: true as const, signInRequired: true as const }
  const store = read(); store.calls.push(command)
  localStorage.setItem(key, JSON.stringify(store))
  if (params.has("hold-guest-read") && command.action === "read")
    await new Promise<void>((resolve) => window.addEventListener("release-guest-read", () => resolve(), { once: true }))
  const pages = JSON.parse(localStorage.getItem("sharing-canvas-fixture") ?? '{"pages":[]}')
  const page = pages.pages.find((item: { id: string }) => item.id === command.pageId)
  const grant = store.invites.find(item => item.email === `person${person}@example.org` && item.accepted && !item.revoked)
  const deny = () => ({ ok: false as const, code: "scope" as const, uncertain: false, error: "This page or invitation is unavailable for this account." })
  if (!page?.guestSharingReady) return deny()
  if (command.action === "accept") {
    const invitation = store.invites.find(item => item.id === command.invitationId && item.email === `person${person}@example.org` && !item.revoked)
    if (!invitation) return deny()
    invitation.accepted = true
  } else if (person !== "1" && !grant) return deny()
  const replayed = "operationId" in command && store.operations.includes(command.operationId)
  if (!replayed) {
    if (command.action === "invite") store.invites.push({ id: command.invitationId, email: command.email, permission: command.permission, accepted: false, revoked: false, expiresAt: new Date(Date.now()+604800000).toISOString() })
    if (command.action === "revoke") store.invites.find(item => item.id === command.invitationId)!.revoked = true
    if (command.action === "edit") {
      if (page.revision !== command.expectedRevision) return { ok: false as const, code: "conflict" as const, uncertain: false, error: "This page changed. Reload before saving." }
      page.draft.title = command.title; page.draft.description = command.description; page.revision++
    }
    if ("operationId" in command) store.operations.push(command.operationId)
  }
  localStorage.setItem("sharing-canvas-fixture", JSON.stringify(pages))
  localStorage.setItem(key, JSON.stringify(store))
  if (params.has("hold-guest-invite") && command.action === "invite" && !replayed)
    await new Promise<void>((resolve) => window.addEventListener("release-guest-invite", () => resolve(), { once: true }))
  if (((params.has("lost-guest-save") && command.action === "edit") || (params.has("lost-guest-invite") && command.action === "invite")) && !store.lost) {
    store.lost = true; localStorage.setItem(key, JSON.stringify(store)); throw new Error("Lost acknowledgement")
  }
  const permission = person === "1" ? "manage" : store.invites.find(item => item.email === `person${person}@example.org` && item.accepted && !item.revoked)!.permission
  const value: PageAccessData = { pageId: command.pageId, permission, canGrantManage: person === "1", revision: page.revision,
    snapshot: pages.guestSnapshots[command.pageId] as WorkspacePageSnapshot,
    draft: permission === "view" ? null : { title: page.draft.title, description: page.draft.description },
    invitations: permission === "manage" ? store.invites.filter(item => !item.revoked) : [], replayed }
  return { ok: true as const, signInRequired: false as const, value }
}
