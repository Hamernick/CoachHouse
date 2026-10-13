import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicHomeResourceExplorer } from "@/components/public/home-resource-explorer"
import { fetchPublicResourceProfile } from "@/lib/queries/public-resource-profile"
import { publicResourceProfileHref } from "@/lib/public-map/resource-profile-href"

export const revalidate = 300

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const item = await fetchPublicResourceProfile(id)
  if (!item) return { title: "Resource not found", robots: { index: false, follow: false } }
  return {
    title: item.title,
    description: item.description || undefined,
    alternates: { canonical: publicResourceProfileHref(item.id) },
  }
}

export default async function ResourceProfilePage({ params, searchParams }: Props) {
  const { id } = await params
  const item = await fetchPublicResourceProfile(id)
  if (!item) notFound()
  return <PublicHomeResourceExplorer searchParams={searchParams} initialResource={item} />
}
