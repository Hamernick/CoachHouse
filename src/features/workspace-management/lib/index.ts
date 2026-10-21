import { z } from "zod"
import { createStarterWorkspaceCatalog } from "./starter-catalog"
import type { Json } from "@/lib/supabase"

export const workspaceNameSchema = z.string().trim().min(1, "Enter a workspace name.").max(80, "Use 80 characters or fewer.")
export const workspaceIdSchema = z.string().uuid()
const entrySchema = z.object({ id: workspaceIdSchema, name: workspaceNameSchema, state: z.record(z.string(), z.unknown()), createdAt: z.string(), updatedAt: z.string() })
const catalogSchema = z.object({ version: z.literal(1), defaultName: workspaceNameSchema, defaultDeleted: z.boolean().optional(), entries: z.array(entrySchema).max(50) })
export const workspaceCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), orgId: workspaceIdSchema, id: workspaceIdSchema, name: workspaceNameSchema }).strict(),
  z.object({ kind: z.literal("delete"), orgId: workspaceIdSchema, id: workspaceIdSchema.nullable(), previousName: workspaceNameSchema }).strict(),
  z.object({ kind: z.literal("rename"), orgId: workspaceIdSchema, id: workspaceIdSchema.nullable(), name: workspaceNameSchema, previousName: workspaceNameSchema }).strict(),
])
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function readWorkspaceCatalog(stored: unknown) {
  // Seed only an absent board. Even an empty saved board or catalog is user state.
  if (stored === undefined || stored === null) return createStarterWorkspaceCatalog()
  const value = record(stored).workspaceCatalog
  if (value === undefined) return { version: 1 as const, defaultName: Object.keys(record(stored)).length ? "Main workspace" : "Build", defaultDeleted: false, entries: [] }
  const result = catalogSchema.safeParse(value)
  if (!result.success) throw new Error("Unable to read saved workspaces. No changes were made.")
  return result.data
}
export function summarizeWorkspaces(stored: unknown) {
  const catalog = readWorkspaceCatalog(stored)
  return [...(catalog.defaultDeleted ? [] : [{ id: null, name: catalog.defaultName }]), ...catalog.entries.map(({ id, name }) => ({ id, name }))]
}
export function selectWorkspaceState(stored: unknown, id?: string | null) {
  if (id === undefined || id === null) {
    if (readWorkspaceCatalog(stored).defaultDeleted) throw new Error("Workspace not found.")
    return record(stored)
  }
  workspaceIdSchema.parse(id)
  const entry = readWorkspaceCatalog(stored).entries.find((item) => item.id === id)
  if (!entry) throw new Error("Workspace not found.")
  return { ...entry.state, workspaceCanvasId: id }
}
// Every legacy/default writer must preserve the catalog; named writes replace
// only their own state. Neither path accepts catalog changes from client state.
export function mergeWorkspaceState(stored: unknown, next: unknown, id?: string | null): Json {
  const root = record(stored)
  const { workspaceCatalog: _catalog, workspaceCanvasId: _id, ...state } = record(next)
  if (!id) {
    selectWorkspaceState(stored)
    return { ...state, workspaceCatalog: root.workspaceCatalog ?? readWorkspaceCatalog(stored) } as Json
  }
  selectWorkspaceState(stored, id)
  const catalog = readWorkspaceCatalog(stored)
  return { ...root, workspaceCatalog: { ...catalog, entries: catalog.entries.map((entry) => entry.id === id ? { ...entry, state, updatedAt: new Date().toISOString() } : entry) } } as Json
}
export function changeWorkspaceCatalog(stored: unknown, command: WorkspaceCommand, now: string): Json {
  const root = record(stored)
  const catalog = readWorkspaceCatalog(stored)
  if (command.kind === "create") {
    const replay = catalog.entries.find((entry) => entry.id === command.id)
    if (replay) {
      if (replay.name !== command.name) throw new Error("This workspace was already created with a different name.")
      return root as Json
    }
    if (catalog.entries.length >= 50) throw new Error("This organization has reached its workspace limit.")
    return { ...root, workspaceCatalog: { ...catalog, entries: [...catalog.entries, { id: command.id, name: command.name, state: { nodes: [], connections: [], visibility: { allCardsHiddenExplicitly: true, organizationHiddenExplicitly: true } }, createdAt: now, updatedAt: now }] } } as Json
  }
  if (command.kind === "delete") {
    if (command.id === null) {
      if (catalog.defaultDeleted) return root as Json
      if (catalog.defaultName !== command.previousName) throw new Error("This workspace changed. Refresh before deleting it.")
      // Keep only sibling canvases and a durable tombstone; never reseed this root.
      return { nodes: [], connections: [], visibility: { allCardsHiddenExplicitly: true, organizationHiddenExplicitly: true }, workspaceCatalog: { ...catalog, defaultDeleted: true } } as Json
    }
    const entry = catalog.entries.find((item) => item.id === command.id)
    if (!entry) return root as Json // Retry after a lost response remains idempotent.
    if (entry.name !== command.previousName) throw new Error("This workspace changed. Refresh before deleting it.")
    return { ...root, workspaceCatalog: { ...catalog, entries: catalog.entries.filter((item) => item.id !== command.id) } } as Json
  }
  const current = command.id ? catalog.entries.find((entry) => entry.id === command.id)?.name : catalog.defaultDeleted ? undefined : catalog.defaultName
  if (!current) throw new Error("Workspace not found.")
  if (current !== command.previousName && current !== command.name) throw new Error("This workspace was renamed by someone else. Refresh before renaming it.")
  return { ...root, workspaceCatalog: { ...catalog, defaultName: command.id ? catalog.defaultName : command.name, entries: catalog.entries.map((entry) => entry.id === command.id ? { ...entry, name: command.name, updatedAt: now } : entry) } } as Json
}
export function allWorkspaceStates(stored: unknown) {
  const catalog = readWorkspaceCatalog(stored)
  return [...(catalog.defaultDeleted ? [] : [{ id: null, state: record(stored) }]), ...catalog.entries.map(({ id, state }) => ({ id, state }))]
}
