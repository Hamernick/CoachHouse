"use client"

import Link from "next/link"
import BadgeCheckIcon from "lucide-react/dist/esm/icons/badge-check"
import { HOME_ORGANIZATION_BADGE_LABEL, HOME_ORGANIZATION_BADGE_DESCRIPTION } from "../lib/home-resource-preview"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { buildPublicImageTransformUrl } from "@/lib/storage/public-url"
import type { HomeResource } from "../lib/home-resource-preview"

export function HomeResourceResults({ items, isCollected, onCollect, disabled = false }: {
  items: HomeResource[]
  isCollected: (item: HomeResource) => boolean
  onCollect: (item: HomeResource) => void
  disabled?: boolean
}) {
  return <ul className="divide-y divide-border/50">
    {items.map((item) => <li key={`${item.kind}:${item.id}`} className="flex min-w-0 items-center gap-1 py-1.5">
      <Button asChild variant="ghost" className="h-auto min-h-16 min-w-0 flex-1 justify-start gap-3 rounded-xl px-2 py-2 text-left whitespace-normal">
        <Link href={item.href} prefetch={false} data-home-resource-result>
          <Avatar className="size-10 shrink-0 rounded-xl">
            <AvatarImage src={buildPublicImageTransformUrl(item.image ?? undefined, { width: 96, height: 96, resize: "contain" })} alt="" className="object-cover" loading="lazy" />
            <AvatarFallback className="rounded-xl bg-muted"><Building2Icon className="size-4 text-muted-foreground" aria-hidden /></AvatarFallback>
          </Avatar>
          <span className="min-w-0"><span className="flex min-w-0 items-center gap-1.5 text-sm font-medium"><span className="truncate">{item.title}</span>{item.organizationBadge && item.kind === "organization" ? <span role="img" aria-label={HOME_ORGANIZATION_BADGE_LABEL} title={HOME_ORGANIZATION_BADGE_DESCRIPTION} className="inline-flex shrink-0"><BadgeCheckIcon aria-hidden className="size-4 fill-blue-600 text-white dark:fill-blue-500" /></span> : null}</span><span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{item.subtitle}</span></span>
        </Link>
      </Button>
      <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" disabled={disabled} aria-label={`${isCollected(item) ? "Remove" : "Collect"} ${item.title}`} aria-pressed={isCollected(item)} onClick={() => onCollect(item)}>
        <BookmarkIcon className={isCollected(item) ? "fill-current" : undefined} aria-hidden />
      </Button>
    </li>)}
  </ul>
}
