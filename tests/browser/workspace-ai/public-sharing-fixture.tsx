import { PublicWorkspacePage } from "../../../src/features/workspace-sharing/components/public-workspace-page"
import type { WorkspacePageSnapshot } from "../../../src/features/workspace-sharing/types"
import { shareId } from "./sharing-actions"
import { useState } from "react"

const snapshot: WorkspacePageSnapshot = {
  version: 1, brand: { name: "Community organization", organizationSlug: "community" },
  title: "Published activities", description: "Approved shared content.", items: [
    { id: shareId(20), title: "Community dinner", content: { kind: "event", startsAt: "2026-10-20T20:00:00Z", location: "LongLocation".repeat(18) } },
    { id: shareId(21), title: "Read the plan", content: { kind: "drive_link", href: "https://docs.google.com/document/d/canonicalFile01/edit" } },
  ],
}
export function PublicSharingFixture() {
  return <main><h1>Reviewed pages</h1><PublicWorkspacePage snapshot={snapshot} embedded /><PublicWorkspacePage snapshot={snapshot} embedded /></main>
}


export function PublicSharingImageFixture() {
  const [logoId, setLogoId] = useState(shareId(61))
  const imageSnapshot: WorkspacePageSnapshot = { ...snapshot, brand: { ...snapshot.brand, logo: { assetId: logoId, width: 100, height: 50 } }, items: [
    { id: shareId(22), title: "Workshop photo", content: { kind: "image", assetId: shareId(60), alt: "Workshop participants", width: 600, height: 300 } },
  ] }
  return <main><h1>Reviewed images</h1>
    <button onClick={() => setLogoId(shareId(62))}>Review another logo</button>
    <section aria-label="Review"><PublicWorkspacePage snapshot={imageSnapshot} imagePreviews={{ [shareId(60)]: "/api/account/workspace-page-image?fixture=reviewed", [logoId]: "/api/account/workspace-page-image?logo=primary&fixture=reviewed" }} embedded /></section>
    <section aria-label="Public"><PublicWorkspacePage snapshot={imageSnapshot} embedded /></section>
    <section aria-label="Invited"><PublicWorkspacePage snapshot={imageSnapshot} imageAudience="guest" embedded /></section>
  </main>
}

export function PublicSharingDocumentFixture() {
  const documentSnapshot: WorkspacePageSnapshot = { ...snapshot, items: [
    { id: shareId(22), title: "Workshop guide", content: { kind: "document", assetId: shareId(60), name: "Community-workshop-guide-with-a-long-name.md" } },
  ] }
  return <main><h1>Reviewed documents</h1>
    <section aria-label="Review"><PublicWorkspacePage snapshot={documentSnapshot} documentPreviews={{ [shareId(60)]: "/api/account/workspace-page-document?fixture=reviewed" }} embedded /></section>
    <section aria-label="Public"><PublicWorkspacePage snapshot={documentSnapshot} embedded /></section>
    <section aria-label="Invited"><PublicWorkspacePage snapshot={documentSnapshot} imageAudience="guest" embedded /></section>
  </main>
}
