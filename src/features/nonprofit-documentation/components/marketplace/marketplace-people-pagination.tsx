"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { marketplacePeoplePageHref } from "../../lib/marketplace-people"

export function MarketplacePeoplePagination({
  page,
  hasMore,
}: {
  page: number
  hasMore: boolean
}) {
  const search = useSearchParams().toString()
  if (page <= 1 && !hasMore) return null

  return (
    <nav aria-label="Community pages" className="mt-3 flex gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" className="min-h-11 rounded-full">
          <Link
            href={marketplacePeoplePageHref(search, page - 1)}
            scroll={false}
          >
            Previous profiles
          </Link>
        </Button>
      ) : null}
      {hasMore ? (
        <Button asChild variant="outline" className="min-h-11 rounded-full">
          <Link
            href={marketplacePeoplePageHref(search, page + 1)}
            scroll={false}
          >
            More profiles
          </Link>
        </Button>
      ) : null}
    </nav>
  )
}
