import { Collapsible } from "@/components/ui/collapsible"
import { WorkspaceManagementProvider, WorkspaceManagementBridge } from "@/features/workspace-management/components/workspace-management-context"
import { WorkspaceSidebarActions } from "@/features/workspace-management/components/workspace-sidebar-actions"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { WorkspaceAccessDialog } from "@/features/workspace-management/components/workspace-access-dialog"
import { DeletedWorkspacesDialog } from "@/features/workspace-management/components/deleted-workspaces-dialog"
import { WorkspaceActionsMenu } from "@/features/workspace-management/components/workspace-actions-menu"
export function WorkspaceAccessFixture() {
 const [trigger,setTrigger]=useState<HTMLButtonElement|null>(null)
 const [deleted,setDeleted]=useState<HTMLButtonElement|null>(null)
 const orgId=new URLSearchParams(location.search).get("orgId")??"99500000-0000-4000-8000-000000000001"
 if(new URLSearchParams(location.search).has("empty-workspaces"))return <WorkspaceManagementProvider><WorkspaceManagementBridge orgId={orgId} currentId={null} canEdit={false} workspaces={empty}/><ul><li><Collapsible defaultOpen><WorkspaceSidebarActions/></Collapsible></li></ul></WorkspaceManagementProvider>
 return <main>{deleted&&<DeletedWorkspacesDialog orgId={orgId} returnFocus={deleted} onClose={()=>setDeleted(null)}/>}<ul><li className="group/workspace relative h-12"><WorkspaceActionsMenu workspace={{id:null,name:"Finance"}} canEdit={false} onAction={(kind,element)=>{if(kind==="permissions")setTrigger(element);if(kind==="deleted-access")setDeleted(element)}} /></li></ul><Button onClick={event=>setTrigger(event.currentTarget)}>Access</Button>{trigger&&<WorkspaceAccessDialog
 target={{orgId,canvasId:null}} returnFocus={trigger} onClose={()=>setTrigger(null)}/>}</main>
}

const empty: []=[]
