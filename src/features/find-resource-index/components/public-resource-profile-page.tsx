"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PublicMapResourceDetail } from "@/components/public/public-map-index/resource-detail"
import { PublicProfileCollectionButton } from "@/components/public/public-map-index/profile-collection-button"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

export function PublicResourceProfilePage({ item, viewer = null }: { item: ExternalResourceMapItem; viewer?: { id: string; email: string | null } | null }) {
  const router = useRouter()
  return (
    <main data-public-resource-profile-page className="bg-background min-h-svh px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl [&_*]:shadow-none">
        <nav aria-label="Profile navigation" className="mb-6 flex items-center justify-between gap-3 px-4">
          <Button asChild variant="ghost" className="rounded-full"><Link href="/">Explore resources</Link></Button>
          <PublicProfileCollectionButton id={item.id} kind="resource" viewer={viewer} />
        </nav>
        <PublicMapResourceDetail item={item} standalone onBack={() => router.push("/")} />
      </div>
    </main>
  )
}
