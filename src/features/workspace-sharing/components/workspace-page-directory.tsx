"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { loadWorkspacePageDirectoryAction, loadWorkspacePageManagementAction } from "../directory-actions"
import type { PageDirectory } from "../lib/page-directory"
import type { WorkspacePage } from "../types"
import { WorkspacePageManagement } from "./workspace-page-management"

export function WorkspacePageDirectory({ pageId, after }: { pageId?: string; after?: string }) {
  const [directory, setDirectory] = useState<PageDirectory | null>(null)
  const [page, setPage] = useState<WorkspacePage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let alive = true
    setDirectory(null); setPage(null); setError(null)
    async function load() {
      if (pageId) {
        const result = await loadWorkspacePageManagementAction({ pageId })
        if (alive) { if (result.ok) setPage(result.value); else setError(result.error) }
      } else {
        const result = await loadWorkspacePageDirectoryAction(after ? { after } : {})
        if (alive) { if (result.ok) setDirectory(result.value); else setError(result.error) }
      }
    }
    void load().catch(() => { if (alive) setError("Unable to load shared pages. Try again.") })
    return () => { alive = false }
  }, [pageId, after, reload])
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
    <h1 className="text-2xl font-semibold">Shared pages</h1>
    {error ? <div role="alert" className="flex flex-col items-start gap-3"><p className="text-sm">{error}</p><Button className="min-h-11 rounded-xl" variant="outline" onClick={() => setReload(reload + 1)}>Retry</Button><Link className="focus-ring rounded-md text-sm underline" href="/workspace">Back to workspace</Link></div>
      : page ? <WorkspacePageManagement key={`${page.id}:${reload}`} page={page} onReload={() => setReload(reload + 1)} />
      : directory ? <>
        <p className="text-muted-foreground text-sm">Saved pages across this organization’s workspaces.</p>
        {directory.pages.length ? <ul className="divide-y rounded-2xl border px-4" aria-label="Saved shared pages">
          {directory.pages.map((item) => <li key={item.id}><Link href={`/workspace/shared-pages?page=${item.id}`} className="focus-ring flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-lg py-3">
            <span className="min-w-0 break-words text-sm font-medium">{item.title || "Untitled page"}</span><Badge variant="outline" className="shrink-0">{item.visibility === "public" ? "Public" : "Private"}</Badge>
          </Link></li>)}
        </ul> : <p className="rounded-2xl border p-5 text-sm">No saved pages. Select a Particle on the board and choose Share.</p>}
        <nav aria-label="Shared page navigation" className="flex flex-wrap gap-2">
          <Button className="min-h-11 rounded-xl" asChild variant="outline"><Link href="/workspace">Back to workspace</Link></Button>
          {after && <Button className="min-h-11 rounded-xl" asChild variant="outline"><Link href="/workspace/shared-pages">First page</Link></Button>}
          {directory.next && <Button className="min-h-11 rounded-xl" asChild variant="outline"><Link href={`/workspace/shared-pages?after=${directory.next}`}>More pages</Link></Button>}
        </nav>
      </> : <p role="status" className="text-muted-foreground text-sm">Loading shared pages…</p>}
  </main>
}
