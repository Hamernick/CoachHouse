// Controlled local persistence only; real server/SQL source checks have separate tests.
import type { PageEditorData } from "../../../src/features/workspace-sharing/lib/page-editor"
import type { WorkspacePage, WorkspacePageSnapshot } from "../../../src/features/workspace-sharing/types"
import { workspacePageCommandSchema, workspacePageReviewInputSchema } from "../../../src/features/workspace-sharing/lib/page-command"
import { pageEditorRequestSchema } from "../../../src/features/workspace-sharing/lib/page-editor"
export const shareId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const key = "sharing-canvas-fixture"
type Store = { guestSnapshots?: Record<string, WorkspacePageSnapshot>; pages: WorkspacePage[]; calls: unknown[]; retry?: string }
const read = (): Store => JSON.parse(localStorage.getItem(key) ?? '{"pages":[],"calls":[]}')
const write = (store: Store) => localStorage.setItem(key, JSON.stringify(store))
const record = (input: unknown) => { const store = read(); store.calls.push(input); write(store) }
const scopeName = (id: string | null | undefined) => id ? "Named" : "Main"
function snapshot(canvasId: string | null | undefined, draft: WorkspacePage["draft"]): WorkspacePageSnapshot {
  return { version: 1, brand: { name: "Fixture organization", organizationSlug: "fixture" }, title: draft.title, description: draft.description,
    items: draft.particleIds.map((id) => ({ id, title: `${scopeName(canvasId)} ${id === shareId(20) ? "first" : "second"}`, content: { kind: "text" } })) }
}
export async function loadWorkspacePageEditorAction(input: unknown) {
  const request = pageEditorRequestSchema.parse(input); record({ action: "load", ...request })
  const pages = read().pages.filter(page => page.canvasId === (request.canvasId ?? null))
  const page = request.pageId ? pages.find(item => item.id === request.pageId) : (request.initialParticleIds?.length ?? 1) === 1 ? pages.find(item => item.draft.particleIds.includes(request.particleId)) : undefined
  const data: PageEditorData = { canvasId: request.canvasId ?? null, workspaceId: request.workspaceId, publishingEnabled: true,
    page: page ?? null, suggestedPageId: crypto.randomUUID(), initialParticleIds: request.initialParticleIds ?? [request.particleId],
    pages: pages.map(page => ({ id: page.id, title: page.draft.title, visibility: page.visibility, particleIds: page.draft.particleIds })),
    choices: [20,21].map(n => ({ id: shareId(n), title: `${scopeName(request.canvasId)} ${n === 20 ? "first" : "second"}`, reason: null })) }
  return { ok: true as const, value: data }
}
export async function reviewWorkspacePageAction(input: unknown) {
  const request = workspacePageReviewInputSchema.parse(input); record({ action: "review", ...request })
  return { ok: true as const, value: { page: null, snapshot: snapshot(request.canvasId, request.draft), reviewToken: "a".repeat(64) } }
}
export async function commitWorkspacePageAction(input: unknown) {
  const command = workspacePageCommandSchema.parse(input); record({ action: "commit", ...command })
  const store = read(), old = store.pages.find(page => page.id === command.pageId)
  if (store.retry === command.operationId && old) return { ok: true as const, value: { page: old, replayed: true } }
  const now = new Date().toISOString()
  const draft = command.intent === "make_private" ? old!.draft : command.draft
  const page: WorkspacePage = { id: command.pageId, orgId: shareId(1), canvasId: command.canvasId ?? null, linkId: command.pageId,
    guestSharingReady: command.intent === "share_with_guests" || old?.guestSharingReady,
    revision: (old?.revision ?? 0) + 1, draft, visibility: command.intent === "publish" ? "public" : command.intent === "make_private" ? "private" : old?.visibility ?? "private",
    publishedSnapshot: command.intent === "publish" ? snapshot(command.canvasId, draft) : old?.publishedSnapshot ?? null,
    publishedAt: command.intent === "publish" ? now : old?.publishedAt ?? null, createdAt: old?.createdAt ?? now, updatedAt: now }
  if (command.intent === "share_with_guests") store.guestSnapshots = { ...store.guestSnapshots, [page.id]: snapshot(command.canvasId, draft) }
  store.pages = [...store.pages.filter(item => item.id !== page.id), page]
  if (new URLSearchParams(location.search).has("lost-save") && !store.retry) {
    store.retry = command.operationId; write(store); throw new Error("Simulated lost acknowledgement")
  }
  write(store)
  return { ok: true as const, value: { page, replayed: false } }
}

export async function loadWorkspacePageDirectoryAction(input: { after?: string }) {
  record({ action: "directory", ...input })
  const rows = read().pages.filter(page => !input.after || page.id > input.after).sort((a, b) => a.id.localeCompare(b.id))
  return { ok: true as const, value: { workspaceId: shareId(1), pages: rows.slice(0, 25).map(page => ({ id: page.id, title: page.draft.title, visibility: page.visibility })), next: rows.length > 25 ? rows[24].id : null } }
}
export async function loadWorkspacePageManagementAction(input: { pageId: string }) {
  record({ action: "manage", ...input })
  const page = read().pages.find(page => page.id === input.pageId)
  return page ? { ok: true as const, value: page } : { ok: false as const, error: "Page unavailable" }
}
