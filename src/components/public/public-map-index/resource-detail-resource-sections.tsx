import MailIcon from "lucide-react/dist/esm/icons/mail"
import PhoneIcon from "lucide-react/dist/esm/icons/phone"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import { PublicMapResourceLinkButton } from "./resource-link-button"
import { shouldShowPublicMapResourceLink } from "@/lib/public-map/resource-link-visibility"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { cn } from "@/lib/utils"
import {
  formatResourceList,
  formatResourceVerifiedDate,
  isExternalHttpHref,
  normalizeResourceHref,
  PUBLIC_MAP_RESOURCE_CONTACT_TYPE_LABELS,
  PUBLIC_MAP_RESOURCE_DELIVERY_MODE_LABELS,
  PUBLIC_MAP_RESOURCE_LINK_TYPE_LABELS,
} from "./resource-detail-helpers"
import {
  PUBLIC_MAP_DETAIL_BODY_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
  PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME,
} from "./sidebar-theme"

function rankPublicMapResourceLink(
  link: NonNullable<ExternalResourceMapItem["links"]>[number]
) {
  if (link.type === "website") return 0
  if (link.isPrimary) return 1
  return 2
}

export function PublicMapResourceLinksSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const links = (item.links ?? [])
    .flatMap((link) => {
      const href = normalizeResourceHref(link.url)
      if (!href) return []
      return [{ ...link, href }]
    })
    .filter(shouldShowPublicMapResourceLink)
    .sort(
      (first, second) =>
        rankPublicMapResourceLink(first) - rankPublicMapResourceLink(second)
    )

  if (links.length === 0) return null

  return (
    <section
      {...getReactGrabOwnerProps({
        ownerId: `public-map-resource-links:${item.id}`,
        component: "PublicMapResourceLinksSection",
        source: "src/components/public/public-map-index/resource-detail-resource-sections.tsx",
        tokenSource: "src/components/public/public-map-index/sidebar-theme.ts",
        slot: "links",
      })}
      className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}
    >
      <h3 className="text-base font-semibold">Links</h3>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {links.map((link) => (
          <PublicMapResourceLinkButton
            key={link.id}
            ownerId={`public-map-resource-link:${item.id}:${link.id}`}
            href={link.href}
            label={link.label || PUBLIC_MAP_RESOURCE_LINK_TYPE_LABELS[link.type]}
            websiteHref={links.find((candidate) => candidate.type === "website")?.href}
            faviconUrl={item.faviconUrl ?? item.logoUrl}
          />
        ))}
      </div>
    </section>
  )
}

export function PublicMapResourceContactSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const contacts = item.contacts ?? []
  if (contacts.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Contact</h3>
      <div className="mt-3 grid gap-2">
        {contacts.map((contact) => {
          const href = normalizeResourceHref(contact.url)
          const ContactIcon = contact.type === "email" ? MailIcon : PhoneIcon
          const content = (
            <>
              <ContactIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {contact.value}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {contact.label ??
                    PUBLIC_MAP_RESOURCE_CONTACT_TYPE_LABELS[contact.type]}
                </span>
              </span>
            </>
          )

          if (!href) {
            return (
              <div
                key={contact.id}
                className="border-border/55 bg-muted/20 flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm"
              >
                {content}
              </div>
            )
          }

          return (
            <a
              key={contact.id}
              href={href}
              className={cn(
                "flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm",
                PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
              )}
            >
              {content}
            </a>
          )
        })}
      </div>
    </section>
  )
}

export function PublicMapResourceAccessSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const deliveryModes = formatResourceList(
    (item.deliveryModes ?? []).map(
      (mode) => PUBLIC_MAP_RESOURCE_DELIVERY_MODE_LABELS[mode]
    )
  )
  const rows = [
    { label: "Access", value: deliveryModes },
    { label: "Status", value: item.availability?.statusLabel },
    { label: "Hours", value: item.hoursLabel },
    { label: "Availability", value: item.availability?.notes },
    { label: "Updated", value: formatResourceVerifiedDate(item.lastUpdatedAt) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value))

  if (rows.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Access</h3>
      <dl className="mt-3 grid gap-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"
          >
            <dt className="text-muted-foreground text-sm leading-5">
              {row.label}
            </dt>
            <dd className="text-foreground min-w-0 text-sm leading-5 font-medium break-words">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function PublicMapResourceServicesSection({
  item,
}: {
  item: ExternalResourceMapItem
}) {
  const services = item.services ?? []
  if (services.length === 0) return null

  return (
    <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
      <h3 className="text-base font-semibold">Services</h3>
      <div className="divide-border/55 mt-3 divide-y">
        {services.map((service) => {
          const intakeHref = normalizeResourceHref(service.intakeUrl)
          const showServiceIdentity =
            service.title.trim().toLowerCase() !==
              item.title.trim().toLowerCase() ||
            (Boolean(service.description) &&
              service.description !== item.description)
          const serviceRows = [
            { label: "Who it helps", value: service.whoItHelps },
            { label: "Eligibility", value: service.eligibility },
            { label: "Cost", value: service.cost },
            {
              label: "Languages",
              value: formatResourceList(service.languages),
            },
            { label: "How to access", value: service.appointmentInfo },
            {
              label: "Documents",
              value: formatResourceList(service.documentsNeeded),
            },
            { label: "Accessibility", value: service.accessibilityNotes },
            { label: "Urgent", value: service.urgentAvailability },
            { label: "Age", value: service.ageRange },
            { label: "Area", value: formatResourceList(service.serviceArea) },
          ].filter((row): row is { label: string; value: string } =>
            Boolean(row.value)
          )

          return (
            <div key={service.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start justify-between gap-2">
                {showServiceIdentity ? (
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{service.title}</p>
                    {service.description ? (
                      <p
                        className={cn("mt-1", PUBLIC_MAP_DETAIL_BODY_CLASSNAME)}
                      >
                        {service.description}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <span />
                )}
                {intakeHref ? (
                  <Button
                    asChild
                    variant="ghost"
                    className={cn(
                      "min-h-11 shrink-0 rounded-full px-3 text-sm",
                      PUBLIC_MAP_SIDEBAR_ACTION_SURFACE_CLASSNAME
                    )}
                  >
                    <a
                      href={intakeHref}
                      target={
                        isExternalHttpHref(intakeHref) ? "_blank" : undefined
                      }
                      rel={
                        isExternalHttpHref(intakeHref)
                          ? "noreferrer"
                          : undefined
                      }
                    >
                      Intake
                    </a>
                  </Button>
                ) : null}
              </div>
              {serviceRows.length > 0 ? (
                <dl className="mt-3 grid gap-2.5">
                  {serviceRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"
                    >
                      <dt className="text-muted-foreground text-sm leading-5">
                        {row.label}
                      </dt>
                      <dd className="text-foreground min-w-0 text-sm leading-5 font-medium break-words">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
