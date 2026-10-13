import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PublicMapOrganizationDetail } from "@/components/public/public-map-index/organization-detail"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { resolveEditorReturnDestination } from "@/lib/workspace/editor-navigation"
import { getWorkspaceEditorPath } from "@/lib/workspace/routes"
import { buildFindOrganizationHref } from "@/lib/find/routes"
import type { OrganizationPublicationReviewData } from "../types"
import { OrganizationPublicationControls } from "./organization-publication-controls"

export function OrganizationPublicationReview({ returnTo, review }: { returnTo?: string; review: OrganizationPublicationReviewData }) {
  const destination = resolveEditorReturnDestination(returnTo)
  const returnHref = destination.label === "Documents" ? "/workspace?drawer=accelerator&focus=organization-launch" : destination.href
  const reviewHref = `/workspace/profile-preview?${new URLSearchParams({ returnTo: returnHref })}`
  const editorHref = (tab: "company" | "programs") => `${getWorkspaceEditorPath({ tab, ...(tab === "company" ? { focus: "public-page" } : {}) })}&${new URLSearchParams({ from: "organization-launch", returnTo: reviewHref })}`
  return (
    <div className="bg-background h-full min-h-0 overflow-y-auto overscroll-auto">
      <div className="mx-auto w-full max-w-3xl">
        <header className="space-y-4 px-4 pt-4 pb-6 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3 min-h-11"><Link href={returnHref}>Back to setup</Link></Button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Review your public profile</h1>
            {!("error" in review) ? <Badge variant="outline">{review.isPublic ? "Public" : "Private"}</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">This is how your saved profile appears on the map. Only programs you chose to share are included. Internal people, documents and notes are not included in this map profile.</p>
        </header>
        {"error" in review ? <div className="space-y-3 px-4 pb-6 sm:px-6"><p role="alert" className="text-sm">{review.error}</p><Button asChild variant="outline" className="min-h-11"><a href={reviewHref}>Reload preview</a></Button></div> : <>
          <div className="mx-4 mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:mx-6">
            <div><p className="text-sm font-medium">{review.location.label}</p><p className="text-muted-foreground mt-1 text-sm">{review.location.detail}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="min-h-11"><Link href={editorHref("company")}>Edit profile</Link></Button>
              <Button asChild variant="ghost" size="sm" className="min-h-11"><Link href={editorHref("programs")}>Choose public programs</Link></Button>
            </div>
          </div>
          <div className="px-4 pb-6 sm:px-6"><PublicMapOrganizationDetail organization={review.organization} /></div>
          <OrganizationPublicationControls key={review.organization.id} returnHref={returnHref} revision={review.revision} isPublic={review.isPublic} available={publicSharingEnabled} hasSlug={Boolean(review.organization.publicSlug)} publicHref={review.organization.publicSlug ? buildFindOrganizationHref(review.organization.publicSlug) : null} />
        </>}
      </div>
    </div>
  )
}
