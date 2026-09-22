import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"

import { Button } from "@/components/ui/button"
import type { MarketplaceResource } from "../../marketplace-types"

export function MarketplaceReferralOffer({
  offer,
}: {
  offer: MarketplaceResource["referralOffer"]
}) {
  if (!offer) return null
  return (
    <div className="mt-3">
      <Button
        asChild
        variant="link"
        className="h-auto min-h-11 justify-start px-0 text-left text-sm whitespace-normal"
      >
        <a href={offer.href} target="_blank" rel="sponsored noopener noreferrer">
          {offer.label}
          <ArrowUpRightIcon aria-hidden />
        </a>
      </Button>
      <p className="text-muted-foreground text-xs leading-5">
        {offer.description}
      </p>
    </div>
  )
}
