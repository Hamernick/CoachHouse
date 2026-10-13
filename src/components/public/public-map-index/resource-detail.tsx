import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { NonprofitSourceBanner } from "./nonprofit-source-banner"
import { cn } from "@/lib/utils"
import {
  PublicMapResourceAddressSection,
  PublicMapResourceDetailChrome,
  PublicMapResourceIdentitySection,
  PublicMapResourceStatusSection,
} from "./resource-detail-primary-sections"
import {
  PublicMapResourceAccessSection,
  PublicMapResourceContactSection,
  PublicMapResourceLinksSection,
  PublicMapResourceServicesSection,
} from "./resource-detail-resource-sections"
import type { PublicMapResourceCurationAction } from "./resource-detail-admin-actions"
import {
  PUBLIC_MAP_DETAIL_BODY_CLASSNAME,
  PUBLIC_MAP_DETAIL_PROFILE_CLASSNAME,
  PUBLIC_MAP_DETAIL_SECTION_CLASSNAME,
} from "./sidebar-theme"

export function PublicMapResourceDetail({
  canManageResourceMap = false,
  collected = false,
  item,
  compact = false,
  standalone = false,
  onBack,
  onToggleCollected,
  resourceMapCurationAction,
}: {
  canManageResourceMap?: boolean
  collected?: boolean
  item: ExternalResourceMapItem
  compact?: boolean
  standalone?: boolean
  onBack: () => void
  onToggleCollected?: (resourceId: string) => void
  resourceMapCurationAction?: PublicMapResourceCurationAction
}) {
  return (
    <div
      data-public-map-profile="resource"
      className={cn(
        PUBLIC_MAP_DETAIL_PROFILE_CLASSNAME,
        compact ? "mb-[max(env(safe-area-inset-bottom),0.75rem)]" : "mb-3"
      )}
    >
      {!standalone ? <PublicMapResourceDetailChrome
        canManageResourceMap={canManageResourceMap}
        collected={collected}
        item={item}
        onBack={onBack}
        onToggleCollected={onToggleCollected}
        resourceMapCurationAction={resourceMapCurationAction}
      /> : null}
      {item.nonprofit ? <NonprofitSourceBanner key={item.id} /> : null}
      <PublicMapResourceIdentitySection item={item} headingLevel={standalone ? "h1" : "h2"} />
      <PublicMapResourceLinksSection item={item} />
      <PublicMapResourceContactSection item={item} />
      <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
        <h3 className="text-base font-semibold">About</h3>
        <p className={cn("mt-1.5", PUBLIC_MAP_DETAIL_BODY_CLASSNAME)}>
          {item.description ||
            (item.nonprofit
              ? "No organization description is available yet."
              : "This resource is listed from external data and is being prepared for review.")}
        </p>
      </section>
      <PublicMapResourceServicesSection item={item} />
      <PublicMapResourceAccessSection item={item} />
      {item.nonprofit ? (
        <section className={PUBLIC_MAP_DETAIL_SECTION_CLASSNAME}>
          <h3 className="text-base font-semibold">Record details</h3>
          <p className="mt-2 text-sm">
            EIN {item.nonprofit.ein.slice(0, 2)}-{item.nonprofit.ein.slice(2)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Source: IRS filings. Operating status unconfirmed.
          </p>
          {(
            [
              ["Description", item.nonprofit.descriptionSourcePeriod, null],
              [
                "Website",
                item.nonprofit.websiteSourcePeriod,
                item.nonprofit.websiteBasis,
              ],
              [
                "Phone",
                item.nonprofit.phoneSourcePeriod,
                item.nonprofit.phoneBasis,
              ],
            ] as const
          ).map(([label, period, basis]) =>
            period ? (
              <p key={label} className="text-muted-foreground mt-1 text-xs">
                {label}: filing ending {period}
                {basis === "provider_confirmed"
                  ? "; also checked against the provider website"
                  : ""}
                .
              </p>
            ) : null
          )}
        </section>
      ) : (
        <PublicMapResourceStatusSection item={item} />
      )}
      <PublicMapResourceAddressSection item={item} />
    </div>
  )
}
