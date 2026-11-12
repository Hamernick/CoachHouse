import type { WorkspaceAccessChange, WorkspaceAccessTarget } from "@/features/workspace-management/lib/access"
async function request(input: WorkspaceAccessTarget | WorkspaceAccessChange) {
 const response=await fetch("/__fixture/workspace-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
 return response.json()
}
export const loadWorkspaceAccess=request
export const saveWorkspaceAccess=request
