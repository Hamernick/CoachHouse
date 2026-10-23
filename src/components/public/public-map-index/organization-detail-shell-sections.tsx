"use client"

import { useState } from "react"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import HeartIcon from "lucide-react/dist/esm/icons/heart"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"
import WifiIcon from "lucide-react/dist/esm/icons/wifi"

import { PublicProfileEin } from "@/components/public/public-profile-ein"
import { ShareButton } from "@/components/shared/share-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  PUBLIC_MAP_GROUP_LABELS,
  type PublicMapGroupKey,
} from "@/lib/public-map/groups"
import {
  PUBLIC_MAP_RESOURCE_CATEGORY_COLORS,
  type PublicMapResourceTopLevelCategoryKey,
} from "@/lib/public-map/resource-categories"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

import {
  type OrganizationDetailActionLink,
} from "./organization-detail-helpers"
import {
  PublicMapOrganizationAdminActions,
  type PublicMapOrganizationCurationAction,
} from "./organization-detail-admin-actions"
import { OrganizationDetailIdentityLinks } from "./organization-detail-identity-links"
import { PublicMapResourceCategoryIcon } from "./resource-category-icon"
import {
  PUBLIC_MAP_DETAIL_BODY_CLASSNAME,
  PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME,
  PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
  PUBLIC_MAP_DETAIL_IDENTITY_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
  PUBLIC_MAP_DETAIL_TITLE_CLASSNAME,
  PUBLIC_MAP_FILTER_PILL_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME,
} from "./sidebar-theme"

type DetailPanelChromeProps = {
  canManageResourceMap?: boolean
  className?: string
  organizationCurationAction?: PublicMapOrganizationCurationAction
  organization: PublicMapOrganization
  favorites: string[]
  onBack: () => void
  onToggleFavorite: (organizationId: string) => void
}

const ORGANIZATION_GROUP_CATEGORY_MAP: Record<
  PublicMapGroupKey,
  PublicMapResourceTopLevelCategoryKey
> = {
  education: "education",
  community: "community",
  health: "health",
  housing: "housing",
  funding: "finance",
  workforce: "employment",
  climate: "environment",
  global: "international",
}

type DetailIdentityProps = {
  headingLevel?: "h1" | "h2"
  organization: PublicMapOrganization
  profileImageSrc: string | null
  profileInitials: string
  location: string
}

type DetailAboutProps = {
  isOnlineOnly?: boolean
  primaryGroup: PublicMapGroupKey
  aboutCopy: string
  aboutExpanded: boolean
  aboutNeedsToggle: boolean
  onToggle: () => void
}

function OrganizationDetailActionLinkContent({
  action,
}: {
  action: OrganizationDetailActionLink
}) {
  const Icon = action.icon

  return (
    <span
      data-public-map-organization-action-content="true"
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center"
    >
      <span
        data-public-map-organization-action-icon="true"
        className="inline-flex size-5 shrink-0 items-center justify-center"
        aria-hidden
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span
        data-public-map-organization-action-label="true"
        className="leading-none"
      >
        {action.label}
      </span>
    </span>
  )
}

export function OrganizationDetailPanelChrome({
  canManageResourceMap = false,
  className,
  organizationCurationAction,
  organization,
  favorites,
  onBack,
  onToggleFavorite,
}: DetailPanelChromeProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <OrganizationDetailBackButton onBack={onBack} />
      <OrganizationDetailHeaderActions
        canManageResourceMap={canManageResourceMap}
        organizationCurationAction={organizationCurationAction}
        organization={organization}
        favorites={favorites}
        onBack={onBack}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  )
}

export function OrganizationDetailBackButton({
  className,
  onBack,
}: {
  className?: string
  onBack: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onBack}
      className={cn(
        PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
        PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME,
        className
      )}
      aria-label="Back to search"
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden />
    </Button>
  )
}

export function OrganizationDetailHeaderActions({
  canManageResourceMap = false,
  className,
  organizationCurationAction,
  organization,
  favorites,
  onBack,
  onToggleFavorite,
}: DetailPanelChromeProps) {
  const shareUrl = organization.publicSlug
    ? `/${encodeURIComponent(organization.publicSlug)}`
    : undefined
  const isFavorite = favorites.includes(organization.id)
  const favoriteLabel = isFavorite
    ? `Remove ${organization.name} from My Map`
    : `Collect ${organization.name} in My Map`

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {canManageResourceMap && organizationCurationAction ? (
        <PublicMapOrganizationAdminActions
          curationAction={organizationCurationAction}
          organization={organization}
          onComplete={onBack}
        />
      ) : null}
      {shareUrl ? (
        <ShareButton
          url={shareUrl}
          title={organization.name}
          iconOnly
          buttonVariant="ghost"
          buttonSize="icon"
          className={cn(
            PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
            PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME
          )}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
          isFavorite
            ? "border-sky-400/55 bg-sky-500/12 text-sky-600 hover:bg-sky-500/18 dark:border-sky-400/45 dark:bg-sky-400/14 dark:text-sky-300 dark:hover:bg-sky-400/20"
            : PUBLIC_MAP_DETAIL_CHROME_BUTTON_SURFACE_CLASSNAME
        )}
        onClick={() => onToggleFavorite(organization.id)}
        aria-label={favoriteLabel}
        aria-pressed={isFavorite}
        title={favoriteLabel}
      >
        <HeartIcon
          className={cn("h-4 w-4", isFavorite && "fill-current")}
          aria-hidden
        />
      </Button>
    </div>
  )
}

export function OrganizationDetailIdentitySection({
  headingLevel: Heading = "h2",
  organization,
  profileImageSrc,
  profileInitials,
  location,
}: DetailIdentityProps) {
  return (
    <div
      className={cn(
        PUBLIC_MAP_DETAIL_IDENTITY_CLASSNAME,
        "gap-3 sm:flex-col sm:items-center sm:text-center"
      )}
    >
      <Avatar className="border-border/70 bg-muted/25 size-16 shrink-0 rounded-2xl border">
        <AvatarImage
          src={profileImageSrc ?? undefined}
          alt={`${organization.name} profile`}
          className="object-cover"
        />
        <AvatarFallback className="bg-muted/45 text-foreground rounded-2xl text-base font-semibold">
          {profileInitials}
        </AvatarFallback>
      </Avatar>
      <div className="w-full min-w-0 flex-1">
        <Heading
          className={cn(
            PUBLIC_MAP_DETAIL_TITLE_CLASSNAME,
            "text-xl leading-7 tracking-tight sm:text-2xl sm:leading-8"
          )}
        >
          {organization.name}
        </Heading>
        {organization.tagline ? (
          <p className="text-muted-foreground mx-auto mt-0.5 max-w-lg text-sm leading-5 text-pretty">
            {organization.tagline}
          </p>
        ) : null}
        {location ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs leading-5">
              <MapPinIcon className="size-3 shrink-0" aria-hidden />
              {location}
            </span>
          </div>
        ) : null}
        <PublicProfileEin value={organization.ein} formationStatus={organization.formationStatus} />
        <OrganizationDetailIdentityLinks organization={organization} />
      </div>
    </div>
  )
}

export function OrganizationDetailActionLinks({
  actionLinks,
}: {
  actionLinks: OrganizationDetailActionLink[]
}) {
  const [copyingActionKey, setCopyingActionKey] = useState<string | null>(null)

  if (actionLinks.length === 0) return null

  async function handleCopyAction(
    action: Extract<OrganizationDetailActionLink, { kind: "copy" }>
  ) {
    try {
      setCopyingActionKey(action.key)
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(action.value)
        toast.success("Phone number copied", {
          description: action.value,
        })
        return
      }
      if (typeof window !== "undefined") {
        window.prompt("Copy this number:", action.value)
      }
    } catch {
      toast.error("Couldn't copy phone number")
    } finally {
      setCopyingActionKey(null)
    }
  }

  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {actionLinks.map((action) => {
        if (action.kind === "copy") {
          return (
            <Button
              key={action.key}
              type="button"
              variant="ghost"
              onClick={() => void handleCopyAction(action)}
              disabled={copyingActionKey === action.key}
              className={cn(
                "h-16 min-h-16 rounded-xl px-3 text-sm",
                PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
              )}
            >
              <OrganizationDetailActionLinkContent action={action} />
            </Button>
          )
        }

        return (
          <Button
            key={action.key}
            asChild
            variant="ghost"
            className={cn(
              "h-16 min-h-16 rounded-xl px-3 text-sm",
              PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
            )}
          >
            <a
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noreferrer" : undefined}
            >
              <OrganizationDetailActionLinkContent action={action} />
            </a>
          </Button>
        )
      })}
    </div>
  )
}

export function OrganizationDetailAboutSection({
  isOnlineOnly = false,
  primaryGroup,
  aboutCopy,
  aboutExpanded,
  aboutNeedsToggle,
  onToggle,
}: DetailAboutProps) {
  const category = ORGANIZATION_GROUP_CATEGORY_MAP[primaryGroup]
  const badgeClassName = cn(
    PUBLIC_MAP_FILTER_PILL_CLASSNAME,
    "text-muted-foreground inline-flex h-6 items-center gap-1.5 text-[11px] sm:h-6"
  )

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">About</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {isOnlineOnly ? (
            <span className={badgeClassName}>
              <WifiIcon className="text-primary size-3 shrink-0" aria-hidden />
              Online resource
            </span>
          ) : null}
          <span className={badgeClassName}>
            <PublicMapResourceCategoryIcon
              category={category}
              className="size-3"
              style={{ color: PUBLIC_MAP_RESOURCE_CATEGORY_COLORS[category] }}
            />
            {PUBLIC_MAP_GROUP_LABELS[primaryGroup]}
          </span>
        </div>
      </div>
      <p className={cn("mt-1.5", PUBLIC_MAP_DETAIL_BODY_CLASSNAME)}>
        {aboutCopy}
        {aboutNeedsToggle ? (
          <>
            {" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-primary h-auto px-0 py-0 text-sm"
              onClick={onToggle}
            >
              {aboutExpanded ? "View less" : "View more"}
            </Button>
          </>
        ) : null}
      </p>
    </section>
  )
}
