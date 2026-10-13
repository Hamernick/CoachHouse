import { Suspense, type ReactNode } from "react"

import { HomeCanvasFindShell } from "@/components/public/home-canvas-find-shell"
import { SidebarContent } from "@/components/ui/sidebar"

import { DocumentationRail } from "./documentation-rail"
import { DocumentationSearchForm } from "./documentation-search-form"

export function DocumentationShell({ children }: { children: ReactNode }) {
  return (
    <HomeCanvasFindShell
      sidebarFallback={
        <SidebarContent>
          <DocumentationRail />
        </SidebarContent>
      }
      showPublicSearch={false}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-4 py-2 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="h-11 min-w-0 flex-1 md:h-8 lg:max-w-56 xl:max-w-64" />}>
            <DocumentationSearchForm />
          </Suspense>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </HomeCanvasFindShell>
  )
}
