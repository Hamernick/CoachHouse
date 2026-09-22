import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import type { MarketplaceResource } from "../../marketplace-types"
import { getMarketplaceProviderArtwork } from "./marketplace-provider-artwork"

export function MarketplaceProviderLogo({
  resource,
}: {
  resource: MarketplaceResource
}) {
  const image = getMarketplaceProviderArtwork(resource)
  if (!image) return null
  const width = Math.min(128, Math.round((32 * image.width) / image.height))
  return (
    <Avatar
      className="h-8 max-w-32 rounded-md bg-white"
      style={{ width, height: Math.round((width * image.height) / image.width) }}
      aria-hidden
      data-marketplace-provider-logo={resource.id}
      {...getReactGrabOwnerProps({
        ownerId: `marketplace-resource:${resource.id}`,
        component: "MarketplaceProviderLogo",
        source:
          "src/features/nonprofit-documentation/components/marketplace/marketplace-provider-logo.tsx",
        canonicalOwnerSource:
          "src/features/nonprofit-documentation/components/marketplace/marketplace-provider-logo.tsx",
        canonicalOwnerReason:
          "Owns the provider image size, fit, and rounded clipping.",
        tokenSource: "src/components/ui/avatar.tsx",
        slot: "provider-logo",
      })}
    >
      <AvatarImage
        src={image.src}
        alt=""
        className="rounded-[inherit] object-cover"
      />
      <AvatarFallback className="rounded-[inherit] bg-white text-xs text-zinc-950">
        {resource.provider
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")}
      </AvatarFallback>
    </Avatar>
  )
}
