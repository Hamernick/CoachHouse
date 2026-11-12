"use client"
import { useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { WorkspaceCanvasChatContext } from "./workspace-canvas-chat"
import { PlanningComposerProvider } from "@/components/workspace/planning-composer-context"
import { PlanningSidebarSurface } from "@/features/workspace-objectives/client"

/** Feed expansion does not change the anchored input or conversation dimensions. */
export function WorkspaceChatPlanning({ children, planning, scopeKey = "local" }: { children: ReactNode; planning?: ReactNode; scopeKey?: string }) {
  const anchored = useContext(WorkspaceCanvasChatContext)
  return <PlanningComposerProvider key={scopeKey}><div className="relative">
    {children}
    {planning && <div data-workspace-chat-planning className={cn("nodrag nopan nowheel mt-1 pointer-events-auto", anchored ? "absolute inset-x-2.5 top-full" : "mx-2.5")}>
      <PlanningSidebarSurface columns>{planning}</PlanningSidebarSurface>
    </div>}
  </div></PlanningComposerProvider>
}
