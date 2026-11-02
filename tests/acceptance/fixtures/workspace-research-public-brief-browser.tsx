// Actual research session; deterministic action/network transport only.
import { createRoot } from "react-dom/client"
import { WorkspaceResearch } from "@/features/workspace-ai/components/workspace-research"
createRoot(document.getElementById("root")!).render(<WorkspaceResearch target={{organizationId:"10000000-0000-4000-8000-000000000001",objectiveId:"10000000-0000-4000-8000-000000000002",revision:0}} userId="10000000-0000-4000-8000-000000000003" onProposal={async()=>false} onClose={()=>{}} />)
