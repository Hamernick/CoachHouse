import Image from "next/image"
import SproutIcon from "lucide-react/dist/esm/icons/sprout"
import HandHeartIcon from "lucide-react/dist/esm/icons/hand-heart"
import UsersRoundIcon from "lucide-react/dist/esm/icons/users-round"
import BookOpenIcon from "lucide-react/dist/esm/icons/book-open"
import HouseIcon from "lucide-react/dist/esm/icons/house"
import HeartHandshakeIcon from "lucide-react/dist/esm/icons/heart-handshake"
import type { BrandAssetId } from "../../types"
import artwork from "../../assets/heroes/tools-brand-identity.webp"
import { brandIdentityOwner } from "./brand-identity-owner"
const illustrations = [
  HandHeartIcon,
  SproutIcon,
  UsersRoundIcon,
  BookOpenIcon,
  HouseIcon,
  HeartHandshakeIcon,
]
export function BrandExampleMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-[0.3em] font-sans leading-none font-semibold tracking-tight">
      <SproutIcon
        className="size-[1.1em] shrink-0"
        strokeWidth={1.7}
        aria-hidden
      />
      {!compact ? <span>Community</span> : null}
    </span>
  )
}
export function BrandAssetExample({ id }: { id: BrandAssetId }) {
  if (id === "application-image" || id === "application-vertical-image")
    return (
      <Image
        src={artwork}
        alt="Example campaign artwork"
        fill
        sizes="720px"
        className="object-cover"
      />
    )
  const Illustration = illustrations[Number(id.split("-").at(-1)) - 1]
  return (
    <span
      className="text-foreground/80 flex size-full items-center justify-center p-6"
      role="img"
      aria-label="Example artwork"
      {...brandIdentityOwner(
        "brand-asset-example",
        "BrandAssetExample",
        id,
        "example"
      )}
    >
      {Illustration ? (
        <Illustration className="size-10 sm:size-12" strokeWidth={1.1} aria-hidden />
      ) : (
        <span
          className={
            id === "brand-mark" ? "text-4xl" : "text-[clamp(1.25rem,2.5vw,2rem)]"
          }
        >
          <BrandExampleMark compact={id === "brand-mark"} />
        </span>
      )}
    </span>
  )
}
