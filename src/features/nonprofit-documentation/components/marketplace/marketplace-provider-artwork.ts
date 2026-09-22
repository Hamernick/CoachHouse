import type { StaticImageData } from "next/image"
import type { MarketplaceResource } from "../../marketplace-types"
import adobe from "../../assets/marketplace-providers/adobe.webp"
import asana from "../../assets/marketplace-providers/asana.webp"
import boardsource from "../../assets/marketplace-providers/boardsource.webp"
import candid from "../../assets/marketplace-providers/candid.webp"
import canva from "../../assets/marketplace-providers/canva.webp"
import catchafire from "../../assets/marketplace-providers/catchafire.webp"
import coachHouse from "../../assets/marketplace-providers/coach-house.webp"
import designGigs from "../../assets/marketplace-providers/design-gigs-for-good.webp"
import givebutter from "../../assets/marketplace-providers/givebutter.webp"
import google from "../../assets/marketplace-providers/google.webp"
import grantsGov from "../../assets/marketplace-providers/grants-gov.webp"
import idealist from "../../assets/marketplace-providers/idealist.webp"
import irs from "../../assets/marketplace-providers/irs.webp"
import littleGreenLight from "../../assets/marketplace-providers/little-green-light.webp"
import microsoft from "../../assets/marketplace-providers/microsoft.webp"
import taproot from "../../assets/marketplace-providers/taproot.webp"
import techsoup from "../../assets/marketplace-providers/techsoup.webp"
import trustlaw from "../../assets/marketplace-providers/trustlaw.webp"
import { getDocumentationArtwork } from "../documentation-artwork"

const PROVIDER_ARTWORK: Record<string, StaticImageData | undefined> = {
  Adobe: adobe,
  Asana: asana,
  BoardSource: boardsource,
  Candid: candid,
  Canva: canva,
  Catchafire: catchafire,
  "Coach House": coachHouse,
  "Design Gigs for Good": designGigs,
  Givebutter: givebutter,
  Google: google,
  "Grants.gov": grantsGov,
  Idealist: idealist,
  "Internal Revenue Service": irs,
  "Little Green Light": littleGreenLight,
  Microsoft: microsoft,
  "Taproot Foundation": taproot,
  TechSoup: techsoup,
  "Thomson Reuters Foundation": trustlaw,
}

export function getMarketplaceProviderArtwork(
  resource: Pick<MarketplaceResource, "id" | "provider" | "artworkKind">
): StaticImageData | null {
  return (
    PROVIDER_ARTWORK[resource.provider] ??
    (resource.artworkKind === "logo"
      ? getDocumentationArtwork(`marketplace/${resource.id}`)
      : null)
  )
}
