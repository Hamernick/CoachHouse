import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { loadPublicWorkspacePage } from "@/features/workspace-sharing"

// Gate before the child loading boundary sends headers. Missing/private pages
// must return a real 404, rather than a streamed 200 followed by Not Found.
export default async function SharedWorkspaceLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ org: string; uniqueLink: string }>
}) {
  const { org, uniqueLink } = await params
  if (!await loadPublicWorkspacePage(org, uniqueLink)) notFound()
  return children
}
