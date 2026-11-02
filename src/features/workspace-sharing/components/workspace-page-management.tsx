"use client"

import { OrganizationFormResponseBrowser } from "@/features/organization-forms/client"
import { useState } from "react"
import Link from "next/link"
import { ParticleButtonLink as ButtonLink, ParticleButton as Button } from "@/components/ui/particle-ui"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog"
import { ParticleAlertDialogCancel as AlertDialogCancel, ParticleAlertDialogAction as AlertDialogAction } from "@/components/ui/particle-ui"
import { usePageEditor } from "../hooks/use-page-editor"
import type { WorkspacePage } from "../types"
import { PageAccessManager } from "./page-access-manager"
import { PublicWorkspacePage } from "./public-workspace-page"

const ignoreDirty = () => {}
/** Recovery controls only: no source lookup, rebinding, new review or publication. */
export function WorkspacePageManagement({ page, onReload }: { page: WorkspacePage; onReload: () => void }) {
  const [responsesOpen, setResponsesOpen] = useState(false)
  const [responseLocked, setResponseLocked] = useState(false)
  const [accessLocked, setAccessLocked] = useState(false)
  const editor = usePageEditor({ particleId: page.draft.particleIds[0], onDirtyChange: ignoreDirty, data: {
    workspaceId: page.orgId, canvasId: page.canvasId, suggestedPageId: page.id, page,
    publishingEnabled: false, pages: [], choices: [], initialParticleIds: page.draft.particleIds,
  } })
  const current = editor.state.page ?? page
  const locked = editor.locked || accessLocked || responseLocked
  const published = current.visibility === "public" ? current.publishedSnapshot : null
  return <section aria-label="Manage shared page" className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap gap-2">
      {locked ? <Button size="lg" color="primary" className="min-h-11 rounded-xl" disabled variant="outline">All shared pages</Button> : <ButtonLink size="lg" color="primary" className="min-h-11 rounded-xl"  variant="outline" as={Link} href="/workspace/shared-pages">All shared pages</ButtonLink>}
      <Button size="lg" color="primary" className="min-h-11 rounded-xl" variant="outline" disabled={locked} onClick={onReload}>Reload</Button>
    </div>
    <h2 className="break-words text-xl font-semibold">{current.draft.title || "Untitled page"}</h2>
    <p className="text-muted-foreground text-sm">{current.visibility === "public" ? "Public link active." : "Private page."} Manage access here, even if the original workspace was deleted. Edit content from its original workspace.</p>
    {editor.state.error && <div role="alert" className="space-y-2 text-sm"><p>{editor.state.error}</p>
      <Button size="lg" color="primary" className="min-h-11 rounded-xl" variant="outline" disabled={editor.state.pending || accessLocked || responseLocked} onClick={() => editor.state.uncertain ? void editor.retry() : onReload()}>{editor.state.uncertain ? "Retry request" : "Reload"}</Button></div>}
    {editor.state.notice && <p role="status" className="text-sm">{editor.state.notice}</p>}
    {published && <div className="flex flex-wrap gap-2">
      <ButtonLink size="lg" color="primary" className="min-h-11 rounded-xl"  variant="outline" href={`/${published.brand.organizationSlug}/${current.linkId}`} target="_blank" rel="noopener noreferrer">Open public page</ButtonLink>
      <AlertDialog><AlertDialogTrigger asChild><Button size="lg" color="primary" className="min-h-11 rounded-xl" variant="outline" disabled={locked}>Make private</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disable the public link?</AlertDialogTitle><AlertDialogDescription>Invited guests keep access. The saved page is preserved.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void editor.write("make_private")}>Make private</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent></AlertDialog>
    </div>}
    {editor.state.pending && <p role="status" className="text-sm">Saving…</p>}
    {current.guestSharingReady && <PageAccessManager pageId={current.id} onLockChange={setAccessLocked} disabled={editor.locked || responseLocked} />}
    <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 w-fit rounded-xl" disabled={locked} aria-expanded={responsesOpen} onClick={() => setResponsesOpen(!responsesOpen)}>Responses</Button>
    {responsesOpen && <OrganizationFormResponseBrowser pageId={current.id} onLockChange={setResponseLocked} />}
    {published && <PublicWorkspacePage snapshot={published} imageAudience="editor" embedded />}
  </section>
}
