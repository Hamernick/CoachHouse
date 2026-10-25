"use client"

import DownloadIcon from "lucide-react/dist/esm/icons/download"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { OrganizationFormationStatusSummary } from "@/components/organization/organization-formation-status-summary"
import type { FormationStatusOption } from "@/lib/organization/formation-status"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { buildPublicImageTransformUrl } from "@/lib/storage/public-url"
import { cn } from "@/lib/utils"

import { PublicMapMediaImage } from "./media-image"
import {
  type OrganizationDetailContactRow,
  type OrganizationDetailStoryField,
} from "./organization-detail-helpers"
import {
  PUBLIC_MAP_DETAIL_BODY_CLASSNAME,
  PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_MEDIA_SURFACE_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME,
} from "./sidebar-theme"

type DetailBrandKitProps = {
  organization: PublicMapOrganization
  brandKitDownloadHref: string | null
}

type DetailOriginProps = {
  storyFields: OrganizationDetailStoryField[]
}

export function OrganizationDetailBrandKitSection({
  organization,
  brandKitDownloadHref,
}: DetailBrandKitProps) {
  const logoCards = [
    {
      key: "primary-logo",
      label: "Primary logo",
      imageUrl: organization.logoUrl,
      alt: `${organization.name} primary logo`,
    },
    {
      key: "logo-mark",
      label: "Logo mark",
      imageUrl: organization.brandMarkUrl,
      alt: `${organization.name} logo mark`,
    },
  ].filter((card) => Boolean(card.imageUrl))

  if (!brandKitDownloadHref && logoCards.length === 0) return null

  return (
    <section className={cn("relative", PUBLIC_MAP_DETAIL_SECTION_CLASSNAME)}>
      <div className="min-w-0 pr-12">
        <h3 className="text-base font-semibold">Brand kit</h3>
        {brandKitDownloadHref ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground absolute top-1 right-1 size-11 rounded-full border border-transparent bg-transparent hover:bg-transparent dark:hover:bg-transparent"
          >
            <a
              href={brandKitDownloadHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Download brand kit"
              title="Download brand kit"
            >
              <DownloadIcon className="size-3" aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>

      {logoCards.length > 0 ? (
        <div
          className={cn(
            "mt-1.5 grid gap-2",
            logoCards.length > 1 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {logoCards.map((card) => (
            <OrganizationDetailLogoCard
              key={card.key}
              label={card.label}
              imageUrl={card.imageUrl!}
              alt={card.alt}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function brandKitPreviewImageUrl(imageUrl: string) {
  try {
    const pathname = decodeURIComponent(new URL(imageUrl).pathname)
    if (/\.svg(?:\+xml)?$/i.test(pathname)) return imageUrl
  } catch {
    return imageUrl
  }
  // The preview is 64px tall; retain a 2x allowance without downloading the original.
  return buildPublicImageTransformUrl(imageUrl, {
    width: 640,
    height: 128,
    resize: "contain",
  }) ?? imageUrl
}

function OrganizationDetailLogoCard({
  label,
  imageUrl,
  alt,
}: {
  label: string
  imageUrl: string
  alt: string
}) {
  return (
    <div className={cn("p-3", PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <PublicMapMediaImage
        src={brandKitPreviewImageUrl(imageUrl)}
        alt={alt}
        wrapperClassName={cn(
          "mt-2 flex h-16 items-center justify-center rounded-xl p-2",
          PUBLIC_MAP_SIDEBAR_MEDIA_SURFACE_CLASSNAME
        )}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  )
}

export function OrganizationDetailOriginSection({
  storyFields,
}: DetailOriginProps) {
  if (storyFields.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Organization story</h3>
      <Accordion type="single" collapsible className="mt-1 w-full">
        {storyFields.map((field) => {
          return (
            <AccordionItem
              key={field.label}
              value={field.label}
              className="border-border/60"
            >
              <AccordionTrigger className="text-muted-foreground pt-1 pb-[3px] text-sm font-medium hover:no-underline">
                {field.label}
              </AccordionTrigger>
              <AccordionContent>
                <OrganizationDetailStoryContent value={field.value} />
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}

export function OrganizationDetailStoryContent({ value }: { value: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert text-foreground max-w-none overflow-x-auto text-sm leading-relaxed break-words",
        "prose-p:my-2 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-5",
        "[&_img]:border-border/60 [&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:overflow-hidden [&_img]:rounded-lg [&_img]:border"
      )}
      // Public narrative HTML is sanitized by resolvePublicOrganizationProfileNarratives.
      dangerouslySetInnerHTML={{ __html: value }}
    />
  )
}

export function OrganizationDetailContactSection({
  contactRows,
}: {
  contactRows: OrganizationDetailContactRow[]
}) {
  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Contact</h3>
      {contactRows.length > 0 ? (
        <div className="mt-2 space-y-2">
          {contactRows.map((row) => (
            <p key={row.label} className="text-foreground text-sm leading-5">
              <span className="text-muted-foreground font-medium">
                {row.label}:
              </span>{" "}
              {row.value}
            </p>
          ))}
        </div>
      ) : (
        <p className={cn("mt-1.5", PUBLIC_MAP_DETAIL_BODY_CLASSNAME)}>
          No contact details listed.
        </p>
      )}
    </section>
  )
}

export function OrganizationDetailFormationSection({
  formationStatus,
}: {
  formationStatus: FormationStatusOption | null
}) {
  if (!formationStatus) return null

  return (
    <section className={cn("space-y-2", PUBLIC_MAP_DETAIL_SECTION_CLASSNAME)}>
      <h3 className="text-base font-semibold">Formation status</h3>
      <OrganizationFormationStatusSummary formationStatus={formationStatus} />
    </section>
  )
}

export function OrganizationDetailAddressSection({
  addressLines,
  isOnlineOnly,
  resourceHref,
}: {
  addressLines: string[]
  isOnlineOnly: boolean
  resourceHref: string | null
}) {
  const webAddress = resourceHref
    ? resourceHref.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Address</h3>
      {isOnlineOnly ? (
        <div className="mt-2 space-y-2">
          {resourceHref && webAddress ? (
            <a
              href={resourceHref}
              target="_blank"
              rel="noreferrer"
              className="text-foreground block text-sm leading-5 break-all underline-offset-4 hover:underline"
            >
              {webAddress}
            </a>
          ) : (
            <p className={PUBLIC_MAP_DETAIL_BODY_CLASSNAME}>
              No web address listed yet.
            </p>
          )}
        </div>
      ) : addressLines.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {addressLines.map((line) => (
            <li key={line} className="text-foreground text-sm leading-5">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("mt-1.5", PUBLIC_MAP_DETAIL_BODY_CLASSNAME)}>
          No address listed yet. This profile can still appear in Find, but it
          will not render a map marker until an address is added.
        </p>
      )}
    </section>
  )
}

export function OrganizationDetailActivitiesSection({
  activities,
}: {
  activities: PublicMapOrganization["activityLinks"]
}) {
  if (activities.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Activity</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {activities.length}
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {activities.map((activity) => (
          <article
            key={activity.id}
            className={cn(
              "rounded-xl px-3 py-2.5",
              PUBLIC_MAP_SIDEBAR_SECTION_ALT_CLASSNAME
            )}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-foreground line-clamp-2 text-sm font-medium">
                  {activity.title}
                </p>
                {activity.description || activity.subtitle ? (
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-sm leading-5">
                    {activity.description || activity.subtitle}
                  </p>
                ) : null}
              </div>
              {activity.ctaUrl || activity.locationUrl ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground shrink-0",
                    PUBLIC_MAP_DETAIL_ICON_BUTTON_CLASSNAME,
                    PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
                  )}
                >
                  <a
                    href={activity.ctaUrl || activity.locationUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${activity.title}`}
                  >
                    <ExternalLinkIcon className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
              {[activity.activityKind, activity.durationLabel]
                .filter((value): value is string => Boolean(value))
                .slice(0, 2)
                .map((chip) => (
                  <span
                    key={chip}
                    className="bg-muted text-muted-foreground inline-flex min-h-6 max-w-full items-center rounded-full px-2 text-xs leading-none"
                  >
                    <span className="truncate">{chip}</span>
                  </span>
                ))}
              {activity.locationType ? (
                <span className="text-muted-foreground inline-flex min-h-6 items-center gap-1 text-xs leading-none">
                  <MapPinIcon className="size-3" aria-hidden />
                  {activity.locationType === "online" ? "Online" : "In person"}
                </span>
              ) : null}
            </div>
            {activity.chips.length > 2 ? (
              <p className="text-muted-foreground/80 mt-1.5 line-clamp-2 text-xs leading-4">
                {activity.chips.slice(2, 5).join(" · ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
