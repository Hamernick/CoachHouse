"use client"

import Link from "next/link"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import {
  marketplaceCostLabel,
  marketplaceTypeLabel,
} from "../../lib/marketplace-directory"
import type { MarketplaceResource } from "../../marketplace-types"
import { MarketplaceProviderLogo } from "./marketplace-provider-logo"

export function MarketplaceResourceCard({
  resource,
  selected,
  disabled,
  onToggle,
}: {
  resource: MarketplaceResource
  selected: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <Card
      className="h-full min-w-0 gap-0 rounded-2xl py-0 shadow-none"
      data-marketplace-resource={resource.id}
      {...getReactGrabOwnerProps({
        ownerId: `marketplace-resource:${resource.id}:card`,
        component: "MarketplaceResourceCard",
        source:
          "src/features/nonprofit-documentation/components/marketplace/marketplace-resource-card.tsx",
        canonicalOwnerSource:
          "src/features/nonprofit-documentation/components/marketplace/marketplace-resource-card.tsx",
        canonicalOwnerReason:
          "Owns Marketplace card content and layout; equal row sizing is set by marketplace-directory.tsx.",
        slot: "card",
      })}
    >
      <CardHeader className="gap-2 p-4 pb-0 sm:p-4 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {marketplaceTypeLabel(resource.type)}
          </span>
          <Badge variant="secondary" className="rounded-full font-normal">
            {marketplaceCostLabel(resource.costModel)}
          </Badge>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <MarketplaceProviderLogo resource={resource} />
          <h3 className="min-w-0 text-base leading-5 font-semibold tracking-tight">
            <Link
              href={`/documentation/marketplace/${resource.id}`}
              className="underline-offset-4 hover:underline"
            >
              {resource.name}
            </Link>
          </h3>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 pt-1 sm:p-4 sm:pt-1">
        <p className="text-muted-foreground text-sm leading-5">
          {resource.description}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2 px-4 pb-4 sm:px-4 sm:pb-4">
        <Button asChild variant="ghost" className="min-h-11 rounded-full px-3 shadow-none">
          <Link href={`/documentation/marketplace/${resource.id}`}>
            View resource
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant={selected ? "secondary" : "outline"}
          className="min-h-11 rounded-full shadow-none"
          disabled={disabled}
          aria-pressed={selected}
          aria-label={`${selected ? "Remove" : "Save"} ${resource.name}${selected ? " from saved resources" : ""}`}
          onClick={() => onToggle(resource.id)}
        >
          <BookmarkIcon
            className={selected ? "fill-current" : undefined}
            aria-hidden
          />
          {selected ? "Saved" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  )
}
