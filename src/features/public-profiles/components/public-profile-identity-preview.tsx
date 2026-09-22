"use client"
import * as React from "react"
import Link from "next/link"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAccountSettingsDrafts } from "@/components/account-settings/account-settings-drafts"
import { toast } from "@/lib/toast"

function initialsFor(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "CH"
  return `${parts[0]?.charAt(0) ?? ""}${parts.at(-1)?.charAt(0) ?? ""}`.toUpperCase()
}

export function ProfileIdentityPreview({
  avatarUrl,
  currentHandle,
  displayName,
  headline,
  idPrefix,
  isLoading,
  isPublic,
  isUploadingAvatar,
  normalizedHandle,
  onAvatarFileSelected,
}: {
  avatarUrl: string | null
  currentHandle: string
  displayName: string
  headline: string
  idPrefix: string
  isLoading: boolean
  isPublic: boolean
  isUploadingAvatar: boolean
  normalizedHandle: string
  onAvatarFileSelected: (file?: File | null) => void
}) {
  const drafts = useAccountSettingsDrafts()
  const avatarInputRef = React.useRef<HTMLInputElement>(null)
  const profileStatus = isLoading
    ? "Loading"
    : isPublic
      ? "Published"
      : "Private"

  return (
    <header className="flex flex-col items-center text-center">
      <div className="relative" aria-busy={isUploadingAvatar}>
        <Avatar className="bg-muted size-24 border sm:size-28">
          <AvatarImage src={avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-xl">
            {initialsFor(displayName)}
          </AvatarFallback>
        </Avatar>
        {isUploadingAvatar ? (
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-full">
            <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <Badge variant="outline" className="mt-5">
        {profileStatus}
      </Badge>
      <h3 className="mt-4 max-w-full text-2xl font-medium tracking-tight text-balance break-words sm:text-3xl">
        {displayName}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-full text-sm break-all">
        {normalizedHandle ? `@${normalizedHandle}` : "@your-name"}
      </p>
      {headline.trim() ? (
        <p className="text-foreground/80 mt-3 max-w-xl text-sm leading-6 text-pretty sm:text-base">
          {headline.trim()}
        </p>
      ) : null}
      <input
        ref={avatarInputRef}
        id={`${idPrefix}-avatar-upload`}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={isUploadingAvatar}
        onChange={(event) => {
          onAvatarFileSelected(event.currentTarget.files?.[0] ?? null)
          event.currentTarget.value = ""
        }}
      />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 sm:h-8"
          disabled={isUploadingAvatar}
          onClick={() => avatarInputRef.current?.click()}
        >
          {isUploadingAvatar ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : null}
          Change photo
        </Button>
        {isPublic && currentHandle ? (
          <Button asChild size="sm" variant="outline" className="h-11 sm:h-8">
            <Link
              href={`/${currentHandle}`}
              onClick={(event) => {
                if (!drafts?.isDirty) return
                event.preventDefault()
                toast.error("Save your changes before viewing your profile.")
              }}
            >
              View profile
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  )
}
