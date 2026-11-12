// Actual research session; deterministic action/network transport only.
import "@/app/globals.css"
import { createRoot } from "react-dom/client"
import { AiUsageProvider } from "@/features/ai-credits/client"
import { ResearchSources } from "@/features/workspace-ai/components/research-sources"
import { WorkspaceResearch } from "@/features/workspace-ai/components/workspace-research"
const embedded = location.search.includes("embedded")
const organizationId = "10000000-0000-4000-8000-000000000001"
document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches)
createRoot(document.getElementById("root")!).render(<AiUsageProvider enabled={embedded} scope="fixture">
  <WorkspaceResearch {...(location.search.includes("autostart") ? {autoStart:true,initialPrompt:"Use permitted documents"} : {})}
    target={embedded ? {mode:"new_objective",organizationId,canvasId:null,revision:0} : {organizationId,objectiveId:"10000000-0000-4000-8000-000000000002",revision:0}}
    userId="10000000-0000-4000-8000-000000000003" onProposal={async()=>false} onClose={()=>{}}>
    {embedded ? composer => <>{composer.panel}<button type="button" disabled={composer.submitDisabled} onClick={()=>void composer.submit()}>Send fixture chat</button></> : undefined}
  </WorkspaceResearch>
  <ResearchSources sources={[{id:"web:1",title:"Reviewed public source",href:"https://example.org/source",kind:"web",revision:null,checkedAt:"2026-11-01T00:00:00Z"}]} />
</AiUsageProvider>)
