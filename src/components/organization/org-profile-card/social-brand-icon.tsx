import Image from "next/image"
import { cn } from "@/lib/utils"
import { siFacebook, siGithub, siTiktok, siX, siYoutube } from "simple-icons"

const socialBrands = {
  twitter: siX,
  facebook: siFacebook,
  youtube: siYoutube,
  tiktok: siTiktok,
  github: siGithub,
}

export type OrganizationSocialPlatform = keyof typeof socialBrands | "instagram" | "linkedin"

export function OrganizationSocialBrandIcon({ platform }: { platform: OrganizationSocialPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="inline-flex size-4 shrink-0 overflow-hidden rounded-[2px] bg-white dark:bg-transparent" aria-hidden="true">
        <Image
          src="/brand/linkedin-in.png"
          alt=""
          width={635}
          height={540}
          className="h-full w-auto max-w-none shrink-0"
        />
      </span>
    )
  }

  if (platform === "instagram") {
    return (
      <Image
        src="/brand/instagram-glyph.png"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 rounded-[2px] object-contain"
      />
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill={`#${socialBrands[platform].hex}`}
      aria-hidden="true"
      focusable="false"
      className={cn(
        platform === "twitter" ? "size-3.5" : "size-4",
        (platform === "twitter" || platform === "tiktok" || platform === "github") && "dark:fill-current"
      )}
    >
      <path d={socialBrands[platform].path} />
    </svg>
  )
}
