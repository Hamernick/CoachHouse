import { z } from "zod"
import type { Json } from "@/lib/supabase"
import type { RoadmapSection } from "@/lib/roadmap"
import type { DocumentsPolicyEntry, OrgDocument } from "@/lib/organization/document-types"

const folderName = z.string().trim().min(1, "Enter a folder name.").max(80)
const fileKey = z.string().regex(/^(project|organization|core|policy|upload|drive|fiscal):[^:\s]{1,160}$/)
const folder = z.object({ id: z.string().uuid(), name: folderName }).strict()
const stateSchema = z.object({
  folders: z.array(folder).max(100),
  placements: z.array(z.object({ fileKey, folderId: z.string().uuid() }).strict()).max(5000),
}).strict().refine((state) => {
  const ids = new Set(state.folders.map((item) => item.id))
  return ids.size === state.folders.length &&
    new Set(state.folders.map((item) => item.name.toLowerCase())).size === state.folders.length &&
    new Set(state.placements.map((item) => item.fileKey)).size === state.placements.length &&
    state.placements.every((item) => ids.has(item.folderId))
})
export type ProjectAssetFolderState = z.infer<typeof stateSchema>
export type ProjectAssetFolder = z.infer<typeof folder>
export type FolderFile = { key: string; name: string; url: string; source: "project" | "organization" | "core" | "policy" | "upload" | "drive" | "fiscal"; downloadUrl?: string }
export type FolderOrganizationDocuments = {
  sections: RoadmapSection[]
  policies: DocumentsPolicyEntry[]
  uploads: { kind: string; title: string; document: OrgDocument | null }[]
  drive: { id: string; name: string; web_view_link: string | null }[]
  userId: string
}

export function organizationFolderFiles(documents: FolderOrganizationDocuments): FolderFile[] {
  return [
    ...documents.sections.map((item) => ({ key: `core:${item.id}`, name: item.title, source: "core" as const, url: "" })),
    ...documents.policies.map((item) => ({ key: `policy:${item.id}`, name: item.title, source: "policy" as const, url: "" })),
    ...documents.uploads.map((item) => ({ key: `upload:${item.kind}`, name: item.title, source: "upload" as const, url: "" })),
    ...documents.drive.map((item) => ({ key: `drive:${item.id}`, name: item.name, source: "drive" as const, url: item.web_view_link?.startsWith("https://") ? item.web_view_link : "" })),
  ]
}

export const folderMutationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), name: folderName }),
  z.object({ type: z.literal("rename"), folderId: z.string().uuid(), name: folderName }),
  z.object({ type: z.literal("remove"), folderId: z.string().uuid() }),
  z.object({ type: z.literal("move"), fileKey, folderId: z.string().uuid().nullable() }),
])
export type FolderMutation = z.infer<typeof folderMutationSchema>

export function getFolderDropFile({ state, files, key, folderId, canEdit, busy }: {
  state: ProjectAssetFolderState
  files: FolderFile[]
  key: string
  folderId: string | null
  canEdit: boolean
  busy: boolean
}) {
  if (!canEdit || busy || (folderId && !state.folders.some((folder) => folder.id === folderId))) return null
  const file = files.find((item) => item.key === key)
  if (!file || (state.placements.find((item) => item.fileKey === key)?.folderId ?? null) === folderId) return null
  return file
}

export function readProjectAssetFolders(options: Json | undefined): ProjectAssetFolderState {
  const value = options && typeof options === "object" && !Array.isArray(options)
    ? options.assetFolders : undefined
  if (value === undefined) return { folders: [], placements: [] }
  return parseProjectAssetFolderState(value)
}

export function parseProjectAssetFolderState(value: unknown): ProjectAssetFolderState {
  const result = stateSchema.safeParse(value)
  if (!result.success) throw new Error("Saved folders could not be read. No changes were made.")
  return result.data
}

export function applyFolderMutation(state: ProjectAssetFolderState, change: FolderMutation, newId: string): ProjectAssetFolderState {
  if ("name" in change && state.folders.some((item) =>
    item.name.toLowerCase() === change.name.toLowerCase() &&
    (change.type === "create" || item.id !== change.folderId),
  )) throw new Error("A folder with that name already exists.")
  if ("folderId" in change && change.folderId && !state.folders.some((item) => item.id === change.folderId)) {
    throw new Error("That folder no longer exists. Refresh and try again.")
  }
  switch (change.type) {
    case "create":
      if (state.folders.length >= 100) throw new Error("This project already has 100 folders.")
      return { ...state, folders: [...state.folders, { id: newId, name: change.name }] }
    case "rename":
      return { ...state, folders: state.folders.map((item) => item.id === change.folderId ? { ...item, name: change.name } : item) }
    case "remove":
      return { folders: state.folders.filter((item) => item.id !== change.folderId), placements: state.placements.filter((item) => item.folderId !== change.folderId) }
    case "move": {
      const placements = state.placements.filter((item) => item.fileKey !== change.fileKey)
      if (change.folderId) placements.push({ fileKey: change.fileKey, folderId: change.folderId })
      if (placements.length > 5000) throw new Error("This project has reached its folder file limit.")
      return { ...state, placements }
    }
  }
}
