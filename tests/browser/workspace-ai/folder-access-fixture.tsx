import { useState } from "react"
import { ProjectFolderAccessDialog } from "@/features/member-workspace/components/projects/project-folder-access-dialog"
import { ProjectAssetFolderGrid } from "@/features/member-workspace/components/projects/project-asset-folder-grid"
export function FolderAccessFixture() {
 const [trigger,setTrigger]=useState<HTMLButtonElement|null>(null)
 const [changed,setChanged]=useState(0)
 const folderId="99890000-0000-4000-8000-000000000011"
 return <main className="p-4"><ProjectAssetFolderGrid state={{folders:[{id:folderId,name:"Finance"}],placements:[]}} files={[]} folderId={null} query="" canEdit={false} busy={false}
 onOpenFolder={()=>{}} onRename={()=>{}} onRemove={()=>{}} onMove={()=>{}} onOpenFile={()=>{}} onAccess={(_,element)=>setTrigger(element)}/>
 <output aria-label="Access refresh count">{changed}</output>
 {trigger&&<ProjectFolderAccessDialog target={{projectId:"99890000-0000-4000-8000-000000000010",folderId,actionScope:"workspace"}} orgId="99890000-0000-4000-8000-000000000001" returnFocus={trigger} onClose={()=>setTrigger(null)} onChanged={()=>setChanged(n=>n+1)}/>}</main>
}
