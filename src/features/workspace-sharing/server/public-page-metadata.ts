import "server-only"

import type { Metadata } from "next"
import { publicOrigin } from "@/lib/public-profile-metadata"
import { loadPublicWorkspacePage } from "./public-page"

export async function workspacePageMetadata(org: string, linkId: string): Promise<Metadata> {
  const page = await loadPublicWorkspacePage(org, linkId)
  if (!page) return { title: "Page not found", description: null,
    robots: { index: false, follow: false }, openGraph: null, twitter: null }
  const { snapshot } = page
  const title = snapshot.title ? `${snapshot.title} · ${snapshot.brand.name}` : snapshot.brand.name
  const description = (snapshot.description || `Shared by ${snapshot.brand.name}.`).replace(/\s+/g, " ").trim().slice(0, 240)
  const canonical = `${publicOrigin()}/${encodeURIComponent(org)}/${encodeURIComponent(linkId)}`
  return {
    title: { absolute: title }, description, alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical },
    twitter: { card: "summary", title, description },
    // Sharing an individual page does not opt the organization into indexing.
    robots: { index: false, follow: false },
  }
}
