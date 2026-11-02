// Actual research session; deterministic action/network transport only.
import "@/app/globals.css"
import { createRoot } from "react-dom/client"
import { ResearchSources } from "@/features/workspace-ai/components/research-sources"
import { WorkspaceResearch } from "@/features/workspace-ai/components/workspace-research"
document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches)
createRoot(document.getElementById("root")!).render(<><WorkspaceResearch target={{organizationId:"10000000-0000-4000-8000-000000000001",objectiveId:"10000000-0000-4000-8000-000000000002",revision:0}} userId="10000000-0000-4000-8000-000000000003" onProposal={async()=>false} onClose={()=>{}} /><ResearchSources sources={[{id:"web:1",title:"Reviewed public source",href:"https://example.org/source",kind:"web",revision:null,checkedAt:"2026-11-01T00:00:00Z"}]} /></>)
