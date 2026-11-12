import type { AccessResult } from "@/lib/workspace/access"
async function request(input: unknown): Promise<AccessResult> {
 const response=await fetch("/__fixture/folder-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
 return response.json()
}
export const loadProjectFolderAccess=request
export const saveProjectFolderAccess=request
