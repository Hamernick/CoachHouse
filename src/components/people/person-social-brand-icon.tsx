import Image from "next/image"
import type { ReactNode } from "react"
import {
  siFacebook,
  siTiktok,
  siX,
  siYoutube,
  type SimpleIcon,
} from "@/lib/brand-icons"

import { cn } from "@/lib/utils"
import type { PersonSocialPlatform } from "@/lib/people/social-links"

const SIMPLE_SOCIAL_ICONS: Record<
  Exclude<PersonSocialPlatform, "instagram" | "linkedin">,
  SimpleIcon
> = {
  facebook: siFacebook,
  tiktok: siTiktok,
  twitter: siX,
  youtube: siYoutube,
}

type PersonSocialBrandIconProps = {
  platform: PersonSocialPlatform
  className?: string
  "aria-hidden"?: boolean
}

export function PersonSocialBrandIcon({
  platform,
  className,
  "aria-hidden": ariaHidden,
}: PersonSocialBrandIconProps) {
  let brandMark: ReactNode

  if (platform === "linkedin") {
    brandMark = (
      <Image
        src="/brand/linkedin-in.png"
        alt=""
        width={635}
        height={540}
        className="h-3 w-auto object-contain"
      />
    )
  } else if (platform === "instagram") {
    brandMark = (
      <Image
        src="/brand/instagram-glyph.png"
        alt=""
        width={184}
        height={184}
        className="size-3 object-contain"
      />
    )
  } else {
    const icon = SIMPLE_SOCIAL_ICONS[platform]
    brandMark = (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        focusable="false"
        className="size-3"
      >
        <path d={icon.path} />
      </svg>
    )
  }

  return (
    <span
      className={cn(
        className,
        "border-border/70 bg-muted/60 inline-flex aspect-square size-5 shrink-0 items-center justify-center rounded-md border"
      )}
      aria-hidden={ariaHidden ?? true}
    >
      {brandMark}
    </span>
  )
}
