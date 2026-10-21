import { notFound } from "next/navigation"
import { PublicWorkspacePage, loadPublicWorkspacePage, workspacePageMetadata } from "@/features/workspace-sharing"
import { getLocale } from "@/lib/locale.server"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ org: string; uniqueLink: string }> }) {
  const { org, uniqueLink } = await params
  return workspacePageMetadata(org, uniqueLink)
}

export default async function SharedWorkspacePage({ params }: { params: Promise<{ org: string; uniqueLink: string }> }) {
  const { org, uniqueLink } = await params
  const publication = await loadPublicWorkspacePage(org, uniqueLink)
  if (!publication) notFound()
  return <PublicWorkspacePage snapshot={publication.snapshot} locale={await getLocale()} />
}
