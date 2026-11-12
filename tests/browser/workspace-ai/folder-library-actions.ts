import type { FolderMutation } from "@/features/member-workspace/lib/project-asset-folders"
export async function loadProjectAssetFolders(projectId: string, actionScope: string) {
  const response = await fetch("/__fixture/folder-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, actionScope }) })
  return response.json()
}
export async function mutateProjectAssetFolder(projectId: string, change: FolderMutation, actionScope: string) {
  const response = await fetch("/__fixture/folder-library-mutation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, change, actionScope }) })
  return response.json()
}
