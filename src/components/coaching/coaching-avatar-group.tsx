import Image from "next/image"
import UserRoundIcon from "lucide-react/dist/esm/icons/user-round"

import { cn } from "@/lib/utils"

type AvatarSize = "xs" | "sm" | "md"

export type CoachingAvatar = { id: string; name: string; imageUrl: string | null }

type CoachingAvatarGroupProps = {
  avatars?: CoachingAvatar[]
  className?: string
  size?: AvatarSize
  label?: string
  limit?: number
  showStatus?: boolean
  showOverflow?: boolean
}

const COACHING_TEAM_AVATARS: Array<{
  id: string
  name: string
  imageUrl: string | null
}> = [
  {
    id: "frank",
    name: "Frank",
    imageUrl:
      "https://vswzhuwjtgzrkxknrmxu.supabase.co/storage/v1/object/public/avatars/Frank.PNG",
  },
  {
    id: "paula",
    name: "Paula",
    imageUrl:
      "https://vswzhuwjtgzrkxknrmxu.supabase.co/storage/v1/object/public/avatars/Paula.png",
  },
  {
    id: "joel",
    name: "Joel",
    imageUrl:
      "https://vswzhuwjtgzrkxknrmxu.supabase.co/storage/v1/object/public/avatars/Joel.png",
  },
]

const SIZE_STYLES: Record<
  AvatarSize,
  { avatar: string; icon: string; sizes: string }
> = {
  xs: { avatar: "h-6 w-6", icon: "h-3 w-3", sizes: "24px" },
  sm: { avatar: "h-8 w-8", icon: "h-3.5 w-3.5", sizes: "32px" },
  md: { avatar: "h-10 w-10", icon: "h-4 w-4", sizes: "40px" },
}

export function CoachingAvatarGroup({
  className,
  size = "sm",
  label = "Coach House coaching team",
  limit,
  showStatus = false,
  showOverflow = false,
  avatars = COACHING_TEAM_AVATARS,
}: CoachingAvatarGroupProps) {
  const styles = SIZE_STYLES[size]
  const visibleAvatars = avatars.slice(
    0,
    limit ?? avatars.length
  )

  return (
    <div className={cn("inline-flex items-center", className)}>
      <ul
        role="list"
        aria-label={label}
        className={cn(
          "flex items-center",
          size === "xs" ? "-space-x-1.5" : "-space-x-2"
        )}
      >
        {visibleAvatars.map((avatar, index) => (
          <li
            key={avatar.id}
            className={cn("relative shrink-0", styles.avatar)}
            title={avatar.name}
          >
            <span className="border-background ring-border/70 absolute inset-0 overflow-hidden rounded-full border-2 ring-1">
              {avatar.imageUrl ? (
                <Image
                  src={avatar.imageUrl}
                  alt={avatar.name}
                  fill
                  sizes={styles.sizes}
                  className="object-cover"
                />
              ) : (
                <span
                  className="bg-muted text-muted-foreground inline-flex size-full items-center justify-center"
                  aria-label={avatar.name}
                >
                  <span className="text-[10px] font-medium" aria-hidden>
                    {avatar.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || <UserRoundIcon className={styles.icon} />}
                  </span>
                </span>
              )}
            </span>
            {showStatus && index === 0 ? (
              <span
                className="border-background absolute right-0 bottom-0 z-10 size-2.5 rounded-full border-2 bg-emerald-500"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
        {showOverflow && avatars.length > visibleAvatars.length ? (
          <li className={cn("bg-muted border-background relative flex shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium", styles.avatar)}
            aria-label={avatars.slice(visibleAvatars.length).map((avatar) => avatar.name).join(", ")}
            title={avatars.slice(visibleAvatars.length).map((avatar) => avatar.name).join(", ")}>
            +{avatars.length - visibleAvatars.length}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
